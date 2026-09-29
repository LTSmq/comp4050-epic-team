import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getOrdersCollection, validateOrder } from "@/lib/orders";

/* =========================================
   GET SAVED ORDERS
   ========================================= */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const collection = getOrdersCollection();
    const orders = await collection
      .find({ ownerUserId: user.userId }, { projection: { _id: 0, ownerUserId: 0 } })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Failed to load saved orders:", error);
    return NextResponse.json({ error: "Failed to load saved orders" }, { status: 500 });
  }
}

/* =========================================
   CREATE SAVED ORDER
   ========================================= */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await request.json();
    const order = validateOrder(body);
    const collection = getOrdersCollection();
    const now = new Date();
    const filter = { ownerUserId: user.userId, orderId: order.orderId };

    const existing = await collection.findOne(filter);

    await collection.updateOne(
      filter,
      {
        $set: { ...order, ownerUserId: user.userId, updatedAt: now },
        $setOnInsert: { createdAt: now },
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