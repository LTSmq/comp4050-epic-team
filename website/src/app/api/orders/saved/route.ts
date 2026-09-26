import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireUser, requirePermission, orderScope } from "@/lib/rbac";
import { validateOrder } from "@/lib/orders/validateOrder";
import client from "@/lib/mongodb";

/* =========================================
   GET SAVED ORDERS (scope depends on role)
   customer -> own orders; team/supervisor -> all, optional ?customerId=
   ========================================= */
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const denied = requirePermission(user, "order:read");
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);
    const collection = db.collection("orders");

    const orders = await collection
      .find(orderScope(user, customerId), {
        projection: { _id: 0, ownerUserId: 0 },
      })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Failed to load saved orders:", error);
    return NextResponse.json(
      { error: "Failed to load saved orders" },
      { status: 500 }
    );
  }
}

/* =========================================
   CREATE SAVED ORDER
   customer -> creates for self; supervisor -> creates for a named customer
   ========================================= */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const denied = requirePermission(user, "order:create");
    if (denied) return denied;

    const body = await request.json();
    const order = validateOrder(body);

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);
    const collection = db.collection("orders");

    // Resolve who the order is FOR, and store the name (fast reads).
    let customerId: string;
    let customerName: string;

    if (user.role !== "customer") {
      customerId = String((body as Record<string, unknown>).customerId ?? "").trim();
      if (!customerId) {
        return NextResponse.json(
          { error: "customerId is required." },
          { status: 400 }
        );
      }
      if (!ObjectId.isValid(customerId)) {
        return NextResponse.json(
          { error: "Invalid customerId." },
          { status: 400 }
        );
      }
      const cust = await db
        .collection("users")
        .findOne({ _id: new ObjectId(customerId) }, { projection: { username: 1 } });
      if (!cust) {
        return NextResponse.json(
          { error: "Customer not found." },
          { status: 404 }
        );
      }
      customerName = cust.username;
    } else {
      customerId = user.userId;
      customerName = user.username;
    }

    const now = new Date();
    const filter = { orderId: order.orderId }; // orderId is globally unique
    const existing = await collection.findOne(filter);

    // Customers may not overwrite an existing order.
    if (existing) {
      return NextResponse.json(
        { error: "OrderID already exists." },
        { status: 409 }
      );
    }

    await collection.updateOne(
      filter,
      {
        $set: {
          ...order,
          customerId,
          customerName,
          ownerUserId: user.userId,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now, progress: "submitted" },
      },
      { upsert: true }
    );

    const saved = await collection.findOne(filter, {
      projection: { _id: 0, ownerUserId: 0 },
    });

    return NextResponse.json(saved, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Failed to save order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save order" },
      { status: 400 }
    );
  }
}