import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth";
import client from "@/lib/mongodb";

type OrderSource =
  | "External"
  | "Manual"
  | "Imported";

type OrderStatus =
  | "Available"
  | "Draft"
  | "Imported";

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

const validSources: OrderSource[] = [
  "External",
  "Manual",
  "Imported",
];

const validStatuses: OrderStatus[] = [
  "Available",
  "Draft",
  "Imported",
];

function validateOrder(
  value: unknown
): SavedOrder {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    throw new Error(
      "Invalid order."
    );
  }

  const body =
    value as Record<
      string,
      unknown
    >;

  const orderId =
    String(
      body.orderId ?? ""
    ).trim();

  if (!orderId) {
    throw new Error(
      "Order ID is required."
    );
  }

  const source =
    String(
      body.source ?? ""
    ) as OrderSource;

  if (
    !validSources.includes(
      source
    )
  ) {
    throw new Error(
      "Invalid order source."
    );
  }

  const status =
    String(
      body.status ?? ""
    ) as OrderStatus;

  if (
    !validStatuses.includes(
      status
    )
  ) {
    throw new Error(
      "Invalid order status."
    );
  }

  if (!Array.isArray(body.items)) {
    throw new Error(
      "Order items are required."
    );
  }

  const items =
    body.items.map(
      (rawItem, index) => {
        if (
          typeof rawItem !==
            "object" ||
          rawItem === null
        ) {
          throw new Error(
            `Item ${
              index + 1
            } is invalid.`
          );
        }

        const item =
          rawItem as Record<
            string,
            unknown
          >;

        const ItemCode =
          String(
            item.ItemCode ??
              ""
          ).trim();

        const ItemReference =
          String(
            item.ItemReference ??
              ""
          ).trim();

        const Width =
          Number(item.Width);

        const Length =
          Number(item.Length);

        const Depth =
          Number(item.Depth);

        const BoxGroup =
          item.BoxGroup ===
            undefined ||
          item.BoxGroup === null
            ? ""
            : String(
                item.BoxGroup
              ).trim();

        if (!ItemCode) {
          throw new Error(
            `Item ${
              index + 1
            } requires ItemCode.`
          );
        }

        if (
          !ItemReference
        ) {
          throw new Error(
            `Item ${
              index + 1
            } requires ItemReference.`
          );
        }

        if (
          !Number.isFinite(
            Width
          ) ||
          Width <= 0 ||
          !Number.isFinite(
            Length
          ) ||
          Length <= 0 ||
          !Number.isFinite(
            Depth
          ) ||
          Depth <= 0
        ) {
          throw new Error(
            `Item ${
              index + 1
            } has invalid dimensions.`
          );
        }

        return {
          ItemCode,
          ItemReference,
          Width,
          Length,
          Depth,

          ...(BoxGroup
            ? {
                BoxGroup,
              }
            : {}),
        };
      }
    );

  return {
    orderId,
    source,
    status,
    items,
  };
}

/* =========================================
   GET SAVED ORDERS
   ========================================= */

export async function GET() {
  try {
    const user =
      await getAuthUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorised",
        },
        {
          status: 401,
        }
      );
    }

    const dbName =
      process.env
        .MONGODB_DB ||
      "fitvisualizer";

    const db =
      client.db(dbName);

    const collection =
      db.collection(
        "orders"
      );

    const orders =
      await collection
        .find(
          {
            ownerUserId:
              user.userId,
          },
          {
            projection: {
              _id: 0,
              ownerUserId: 0,
            },
          }
        )
        .sort({
          updatedAt: -1,
        })
        .toArray();

    return NextResponse.json(
      {
        orders,
      }
    );
  } catch (error) {
    console.error(
      "Failed to load saved orders:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load saved orders",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================
   CREATE SAVED ORDER
   ========================================= */

export async function POST(
  request: Request
) {
  try {
    const user =
      await getAuthUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorised",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const order =
      validateOrder(body);

    const dbName =
      process.env
        .MONGODB_DB ||
      "fitvisualizer";

    const db =
      client.db(dbName);

    const collection =
      db.collection(
        "orders"
      );

    const now = new Date();

    const filter = {
      ownerUserId:
        user.userId,

      orderId:
        order.orderId,
    };

    const existing =
      await collection.findOne(
        filter
      );

    await collection.updateOne(
      filter,
      {
        $set: {
          ...order,

          ownerUserId:
            user.userId,

          updatedAt: now,
        },

        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        upsert: true,
      }
    );

    const saved =
      await collection.findOne(
        filter,
        {
          projection: {
            _id: 0,
            ownerUserId: 0,
          },
        }
      );

    return NextResponse.json(
      saved,
      {
        status: existing
          ? 200
          : 201,
      }
    );
  } catch (error) {
    console.error(
      "Failed to save order:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Failed to save order",
      },
      {
        status: 400,
      }
    );
  }
}