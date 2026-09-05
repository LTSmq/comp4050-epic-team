import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { validateOrder, type OrderRequest } from "@/lib/validateOrder";

import client from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions"; 


export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          message: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    if (!can(user, "order:create"))
  return NextResponse.json({ message: "Only supervisors can create orders." }, { status: 403 });

    const body =
      (await request.json()) as OrderRequest;

    const validationError =
      validateOrder(body);

    if (validationError) {
      return NextResponse.json(
        {
          message: validationError,
        },
        {
          status: 400,
        }
      );
    }

    if (!ObjectId.isValid(user.userId)) {
      return NextResponse.json(
        {
          message: "Invalid user session.",
        },
        {
          status: 401,
        }
      );
    }

    const dbName =
      process.env.MONGODB_DB ||
      "fitvisualizer";

    const db = client.db(dbName);
    const orders = db.collection("orders");

    const userId = new ObjectId(
      user.userId
    );

    const normalizedReference =
      body.orderReference.trim();

    const existingOrder =
      await orders.findOne({
        userId,
        orderReference:
          normalizedReference,
      });

    if (existingOrder) {
      return NextResponse.json(
        {
          message:
            "You already have an order with this reference.",
        },
        {
          status: 409,
        }
      );
    }

    const now = new Date();

    const result = await orders.insertOne({
      userId,

      orderReference:
        normalizedReference,

      destination:
        body.destination.trim(),

      sortingLocation:
        body.sortingLocation.trim(),

      items: body.items,

      status: "submitted",

      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        message:
          "Order submitted successfully.",

        order: {
          id: result.insertedId.toString(),
          orderReference:
            normalizedReference,
          status: "submitted",
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Order creation failed:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Unable to submit the order.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          message: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    if (!ObjectId.isValid(user.userId)) {
      return NextResponse.json(
        {
          message: "Invalid user session.",
        },
        {
          status: 401,
        }
      );
    }

    const dbName =
      process.env.MONGODB_DB ||
      "fitvisualizer";

    const db = client.db(dbName);
    const orders = db.collection("orders");

    const scope =
      user.role === "supervisor"
        ? {}
        : { userId: new ObjectId(user.userId) };

    const results = await orders
      .find(scope)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json(
      {
        orders: results.map((order) => ({
          id: order._id.toString(),
          orderReference:
            order.orderReference,
          destination:
            order.destination,
          sortingLocation:
            order.sortingLocation,
          items: order.items,
          status: order.status,
          createdAt: order.createdAt,
        })),
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Order retrieval failed:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Unable to retrieve orders.",
      },
      {
        status: 500,
      }
    );
  }
}