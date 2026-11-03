import { NextResponse } from "next/server";
import type { ClientSession } from "mongodb";
import { requireUser, requirePermission, orderScope } from "@/lib/rbac";
import {
  validateItems,
  validSources,
  validStatuses,
  type OrderSource,
  type OrderStatus,
} from "@/lib/orders";
import client from "@/lib/mongodb";
import { isLocked, sameItems } from "@/lib/orders/packing";
import { runOrderSolve } from "@/lib/solver/server/runOrderSolve";


/* =========================================
   GET ONE ORDER (customer: own; team/supervisor: any)
   ========================================= */
export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const denied = requirePermission(user, "order:read");
  if (denied) return denied;

  const { orderId } = await context.params;

  const dbName = process.env.MONGODB_DB || "fitvisualizer";
  const db = client.db(dbName);
  const collection = db.collection("orders");

  const order = await collection.findOne(
    { ...orderScope(user), orderId },
    { projection: { _id: 0, ownerUserId: 0 } }
  );

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

/* =========================================
   UPDATE ORDER (supervisor only)
   ========================================= */
export async function PUT(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const denied = requirePermission(user, "order:update");
    if (denied) return denied;

    const { orderId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const source = String(body.source ?? "") as OrderSource;
    const status = String(body.status ?? "") as OrderStatus;

    if (!validSources.includes(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const items = validateItems(body.items);

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);
    const collection = db.collection("orders");

    const filter = { orderId };

    const current = await collection.findOne(filter);
    if (!current) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    // Warehouse is packing it / has packed it: contents are locked.
    if (isLocked(current.progress)) {
      return NextResponse.json(
        { error: "Order is being packed or already packed and cannot be edited." },
        { status: 409 }
      );
    }
    const itemsChanged = !sameItems(current.items ?? [], items);

    // Compare the state read above and make invalidation part of the edit.
    // This conflicts with a claim, solve start/acceptance or another edit.
    const saveEdit = async (session?: ClientSession) => {
      const result = await collection.updateOne(
        {
          _id: current._id,
          orderId,
          progress: "progress" in current ? current.progress : { $exists: false },
          updatedAt: "updatedAt" in current ? current.updatedAt : { $exists: false },
          items: current.items,
          solveGeneration: "solveGeneration" in current ? current.solveGeneration : { $exists: false },
        },
        {
          $set: {
            source, status, updatedAt: new Date(),
            ...(itemsChanged ? {
              items, progress: "submitted", solvedAt: null, hold: null,
              packer: null, claimedAt: null,
              assignedUserId: null, assignedUserName: null, assignedAt: null,
            } : {}),
          },
          ...(itemsChanged ? { $unset: { solveGeneration: "", solutionGeneration: "" } } : {}),
        },
        { session }
      );
      if (result.matchedCount && itemsChanged) {
        await db.collection("solutions").deleteOne({ orderId }, { session });
      }
      return result.matchedCount === 1;
    };
    let edited: boolean;
    if (itemsChanged) {
      const session = client.startSession();
      try {
        edited = await session.withTransaction(() => saveEdit(session));
      } finally {
        await session.endSession();
      }
    } else {
      edited = await saveEdit();
    }
    if (!edited) {
      return NextResponse.json({ error: "Order changed. Refresh and try again." }, { status: 409 });
    }

    // New items = old 3D layout is wrong. Reset and generate a fresh solution.
    if (itemsChanged) {
      await runOrderSolve(orderId);
    }

    const saved = await collection.findOne(filter, {
      projection: { _id: 0, ownerUserId: 0 },
    });

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to update order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update order" },
      { status: 400 }
    );
  }
}

/* =========================================
   DELETE ORDER (supervisor only)
   ========================================= */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const denied = requirePermission(user, "order:delete");
    if (denied) return denied;

    const { orderId } = await context.params;

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);
    const collection = db.collection("orders");

    const session = client.startSession();
    let deleted = false;
    try {
      await session.withTransaction(async () => {
        const result = await collection.deleteOne({ orderId }, { session });
        deleted = result.deletedCount === 1;
        if (deleted) await db.collection("solutions").deleteOne({ orderId }, { session });
      });
    } finally {
      await session.endSession();
    }

    if (!deleted) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete order:", error);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}
