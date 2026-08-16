import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import client from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

type OrderItem = {
  reference: string;
  quantity: number;

  dimensions: {
    width: number;
    height: number;
    depth: number;
  };

  weight: number;
};

type OrderRequest = {
  orderReference: string;
  destination: string;
  sortingLocation: string;
  items: OrderItem[];
};

function validateOrder(body: OrderRequest) {
  if (
    !body.orderReference ||
    typeof body.orderReference !== "string"
  ) {
    return "Order reference is required.";
  }

  if (
    !body.destination ||
    typeof body.destination !== "string"
  ) {
    return "Destination is required.";
  }

  if (
    !body.sortingLocation ||
    typeof body.sortingLocation !== "string"
  ) {
    return "Sorting location is required.";
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "At least one item is required.";
  }

  for (const item of body.items) {
    if (
      !item.reference ||
      typeof item.reference !== "string"
    ) {
      return "Each item requires a reference.";
    }

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      return "Each item requires a valid quantity.";
    }

    if (
      !item.dimensions ||
      item.dimensions.width <= 0 ||
      item.dimensions.height <= 0 ||
      item.dimensions.depth <= 0
    ) {
      return "Each item requires valid dimensions.";
    }

    if (
      typeof item.weight !== "number" ||
      item.weight <= 0
    ) {
      return "Each item requires a valid weight.";
    }
  }

  return null;
}

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

    const results = await orders
      .find({
        userId: new ObjectId(user.userId),
      })
      .sort({
        createdAt: -1,
      })
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