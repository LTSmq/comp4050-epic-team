import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import client from "@/lib/mongodb";
import { validateOrder } from "@/lib/orders/validateOrder";

export async function POST(request: Request) {
  // Machine-to-machine auth: shared API key header, not a user cookie.
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.ORDER_INTAKE_API_KEY;
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    // External senders may omit source/status; default them sensibly.
    const order = validateOrder({
      ...body,
      source: body.source ?? "External",
      status: body.status ?? "Available",
    });

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);
    const collection = db.collection("orders");

    // Optionally attribute to a known customer; else leave unassigned for staff.
    let customerId: string | null = null;
    let customerName = "Unassigned";
    const rawCustomerId = String(body.customerId ?? "").trim();
    if (rawCustomerId) {
      if (!ObjectId.isValid(rawCustomerId)) {
        return NextResponse.json({ error: "Invalid customerId." }, { status: 400 });
      }
      const cust = await db
        .collection("users")
        .findOne({ _id: new ObjectId(rawCustomerId) }, { projection: { username: 1 } });
      if (!cust) {
        return NextResponse.json({ error: "Customer not found." }, { status: 404 });
      }
      customerId = rawCustomerId;
      customerName = cust.username;
    }

    const now = new Date();
    const filter = { orderId: order.orderId };
    const existing = await collection.findOne(filter);

    await collection.updateOne(
      filter,
      {
        $set: { ...order, customerId, customerName, updatedAt: now },
        $setOnInsert: { createdAt: now, progress: "submitted" },
      },
      { upsert: true }
    );

    const saved = await collection.findOne(filter, {
      projection: { _id: 0, ownerUserId: 0 },
    });

    return NextResponse.json(saved, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Order intake failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order intake failed" },
      { status: 400 }
    );
  }
}