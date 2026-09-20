import { NextResponse } from "next/server";

import { requireUser, requirePermission, orderScope } from "@/lib/rbac";
import client from "@/lib/mongodb";

type OrderSource = "External" | "Manual" | "Imported";
type OrderStatus = "Available" | "Draft" | "Imported";

type OrderItem = {
  ItemCode: string;
  ItemReference: string;
  Width: number;
  Length: number;
  Depth: number;
  BoxGroup?: string;
};

function validateItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) {
    throw new Error("Order items are required.");
  }

  return value.map((rawItem, index) => {
    if (typeof rawItem !== "object" || rawItem === null) {
      throw new Error(`Item ${index + 1} is invalid.`);
    }

    const item = rawItem as Record<string, unknown>;

    const ItemCode = String(item.ItemCode ?? "").trim();
    const ItemReference = String(item.ItemReference ?? "").trim();
    const Width = Number(item.Width);
    const Length = Number(item.Length);
    const Depth = Number(item.Depth);
    const BoxGroup =
      item.BoxGroup === undefined || item.BoxGroup === null
        ? ""
        : String(item.BoxGroup).trim();

    if (!ItemCode) {
      throw new Error(`Item ${index + 1} requires ItemCode.`);
    }
    if (!ItemReference) {
      throw new Error(`Item ${index + 1} requires ItemReference.`);
    }
    if (
      !Number.isFinite(Width) || Width <= 0 ||
      !Number.isFinite(Length) || Length <= 0 ||
      !Number.isFinite(Depth) || Depth <= 0
    ) {
      throw new Error(`Item ${index + 1} has invalid dimensions.`);
    }

    return {
      ItemCode,
      ItemReference,
      Width,
      Length,
      Depth,
      ...(BoxGroup ? { BoxGroup } : {}),
    };
  });
}

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

    const validSources: OrderSource[] = ["External", "Manual", "Imported"];
    const validStatuses: OrderStatus[] = ["Available", "Draft", "Imported"];

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

    const result = await collection.updateOne(filter, {
      $set: { source, status, items, updatedAt: new Date() },
    });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
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

    const result = await collection.deleteOne({ orderId });

    if (result.deletedCount === 0) {
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