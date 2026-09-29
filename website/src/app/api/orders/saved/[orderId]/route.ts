import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  getOrdersCollection,
  validateItems,
  validSources,
  validStatuses,
  OrderSource,
  OrderStatus,
} from "@/lib/orders";

/* =========================================
   GET ORDER
   ========================================= */
export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { orderId } = await context.params;
  const collection = getOrdersCollection();

  const order = await collection.findOne(
    { ownerUserId: user.userId, orderId },
    { projection: { _id: 0, ownerUserId: 0 } }
  );

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

/* =========================================
   UPDATE ORDER
   ========================================= */
export async function PUT(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

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
    const collection = getOrdersCollection();
    const filter = { ownerUserId: user.userId, orderId };

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
   DELETE ORDER
   ========================================= */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const { orderId } = await context.params;
    const collection = getOrdersCollection();

    const result = await collection.deleteOne({
      ownerUserId: user.userId,
      orderId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete order:", error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}