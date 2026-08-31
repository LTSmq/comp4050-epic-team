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

function validateItems(
  value: unknown
): OrderItem[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "Order items are required."
    );
  }

  return value.map(
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
          item.ItemCode ?? ""
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

      if (!ItemReference) {
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
}

/* =========================================
   UPDATE ORDER
   ========================================= */

export async function PUT(
  request: Request,
  context: {
    params: Promise<{
      orderId: string;
    }>;
  }
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

    const { orderId } =
      await context.params;

    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    const source =
      String(
        body.source ?? ""
      ) as OrderSource;

    const status =
      String(
        body.status ?? ""
      ) as OrderStatus;

    const validSources:
      OrderSource[] = [
        "External",
        "Manual",
        "Imported",
      ];

    const validStatuses:
      OrderStatus[] = [
        "Available",
        "Draft",
        "Imported",
      ];

    if (
      !validSources.includes(
        source
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid source",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !validStatuses.includes(
        status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid status",
        },
        {
          status: 400,
        }
      );
    }

    const items =
      validateItems(
        body.items
      );

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

    const filter = {
      ownerUserId:
        user.userId,

      orderId,
    };

    const result =
      await collection.updateOne(
        filter,
        {
          $set: {
            source,
            status,
            items,
            updatedAt:
              new Date(),
          },
        }
      );

    if (
      result.matchedCount === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Order not found",
        },
        {
          status: 404,
        }
      );
    }

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
      saved
    );
  } catch (error) {
    console.error(
      "Failed to update order:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Failed to update order",
      },
      {
        status: 400,
      }
    );
  }
}

/* =========================================
   DELETE ORDER
   ========================================= */

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      orderId: string;
    }>;
  }
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

    const { orderId } =
      await context.params;

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

    const result =
      await collection.deleteOne(
        {
          ownerUserId:
            user.userId,

          orderId,
        }
      );

    if (
      result.deletedCount ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Order not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Failed to delete order:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete order",
      },
      {
        status: 500,
      }
    );
  }
}