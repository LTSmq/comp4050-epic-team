import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

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

type SavedOrder = {
  orderId: string;
  source: OrderSource;
  status: OrderStatus;
  items: OrderItem[];
};

const validSources: OrderSource[] = ["External", "Manual", "Imported"];
const validStatuses: OrderStatus[] = ["Available", "Draft", "Imported"];

function validateOrder(value: unknown): SavedOrder {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid order.");
  }

  const body = value as Record<string, unknown>;

  const orderId = String(body.orderId ?? "").trim();
  if (!orderId) {
    throw new Error("Order ID is required.");
  }

  const source = String(body.source ?? "") as OrderSource;
  if (!validSources.includes(source)) {
    throw new Error("Invalid order source.");
  }

  const status = String(body.status ?? "") as OrderStatus;
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid order status.");
  }

  if (!Array.isArray(body.items)) {
    throw new Error("Order items are required.");
  }

  const items = body.items.map((rawItem, index) => {
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

  return { orderId, source, status, items };
}

/* =========================================
   GET SAVED ORDERS (scope depends on role)
   customer -> own orders; team/supervisor -> all, optional ?customerId=
   customerName is denormalised on the order, so no user lookup here.
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

    // Resolve who the order is FOR, and store the name (Option A: fast reads).
    let customerId: string;
    let customerName: string;

    if (user.role === "supervisor") {
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
    if (existing && user.role === "customer") {
      return NextResponse.json(
        { error: "Order already exists." },
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