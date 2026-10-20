
/**
 * Packing (server only).
 *
 * Handles packing-list queries and packing state changes.
 * Orders are automatically assigned to users.
 * FIFO claiming is enforced by claimAssignedOrder().
 */

import type { Filter, UpdateFilter } from "mongodb";

import client from "@/lib/mongodb";
import type { AuthUser } from "@/lib/auth";
import { can } from "@/lib/rbac";

import {
  ORDER_PROGRESS,
  PACKED_WINDOW_MS,
  progressLabel,
  type OrderProgress,
  type PackAction,
  type PackingDetail,
  type PackingItem,
  type PackingRow,
  type Person,
} from "./progress";

import {
  claimAssignedOrder,
  ClaimError,
} from "./claimAssigned";

const dbName = process.env.MONGODB_DB || "fitvisualizer";

/* -------------------------------------------------- */
/* MongoDB order document                             */
/* -------------------------------------------------- */

type OrderDoc = {
  orderId: string;
  items: PackingItem[];
  progress?: OrderProgress;
  customerName?: string;

  // Automatic assignment
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedAt?: Date | null;

  // Packing state
  packer?: Person | null;
  claimedAt?: Date | null;
  packedBy?: Person | null;
  packedAt?: Date | null;

  hold?: {
    itemIndex: number;
    itemCode: string;
    by: Person;
    at: Date;
  } | null;

  solvedAt?: Date | null;
  updatedAt?: Date;
};

const orders = () =>
  client.db(dbName).collection<OrderDoc>("orders");

/* -------------------------------------------------- */
/* Packing row projection                             */
/* -------------------------------------------------- */

const ROW_PROJECTION = {
  _id: 0,
  orderId: 1,
  progress: 1,

  itemCount: {
    $size: { $ifNull: ["$items", []] },
  },

  assignedUserId: 1,
  assignedUserName: 1,
  assignedAt: 1,

  packer: 1,
  claimedAt: 1,
  packedBy: 1,
  packedAt: 1,

  "hold.itemCode": 1,

  solvedAt: 1,
  updatedAt: 1,
} as const;

const iso = (d: unknown) =>
  d instanceof Date ? d.toISOString() : null;

/* -------------------------------------------------- */
/* Convert MongoDB document to packing row            */
/* -------------------------------------------------- */

function toRow(
  raw: Record<string, unknown>
): PackingRow {
  const items = raw.items as unknown[] | undefined;

  const hold = raw.hold as
    | { itemCode?: string }
    | null
    | undefined;

  return {
    orderId: String(raw.orderId),

    customerName:
      (raw.customerName as string) ?? "Unassigned",

    progress: ORDER_PROGRESS.includes(
      raw.progress as OrderProgress
    )
      ? (raw.progress as OrderProgress)
      : "submitted",

    itemCount:
      typeof raw.itemCount === "number"
        ? raw.itemCount
        : items?.length ?? 0,

    // Automatic assignment
    assignedUserId:
      (raw.assignedUserId as string) ?? null,

    assignedUserName:
      (raw.assignedUserName as string) ?? null,

    assignedAt: iso(raw.assignedAt),

    // Packing information
    packer: (raw.packer as Person) ?? null,
    claimedAt: iso(raw.claimedAt),

    packedBy: (raw.packedBy as Person) ?? null,
    packedAt: iso(raw.packedAt),

    holdItemCode: hold?.itemCode ?? null,

    solvedAt: iso(raw.solvedAt),
    updatedAt: iso(raw.updatedAt),
  };
}

function toDetail(
  raw: Record<string, unknown>
): PackingDetail {
  return {
    ...toRow(raw),

    items: Array.isArray(raw.items)
      ? (raw.items as PackingItem[])
      : [],
  };
}

/* -------------------------------------------------- */
/* Packing list queries                               */
/* -------------------------------------------------- */

const LIMIT = 500;

/**
 * Full packing list.
 *
 * Supervisors can request all orders.
 * Team members can request their assigned orders.
 *
 * Oldest solved orders are returned first.
 */
export async function listPackingOrders(
  now = new Date(),
  userId?: string
): Promise<PackingRow[]> {
  const rows = await orders()
    .find(
      {
        ...(userId
          ? { assignedUserId: userId }
          : {}),

        $or: [
          {
            progress: {
              $in: [
                "ready",
                "packing",
                "on_hold",
              ],
            },
          },
          {
            progress: "packed",
            packedAt: {
              $gte: new Date(
                now.getTime() - PACKED_WINDOW_MS
              ),
            },
          },
        ],
      },
      { projection: ROW_PROJECTION }
    )
    .sort({
      solvedAt: 1,
      orderId: 1,
    })
    .limit(LIMIT)
    .toArray();

  return rows.map((r) =>
    toRow(r as Record<string, unknown>)
  );
}

/**
 * Incremental packing updates.
 *
 * Returns null if there are too many changes,
 * allowing the API to send a full reset.
 */
export async function listPackingChanges(
  since: Date,
  userId?: string
): Promise<PackingRow[] | null> {
  const rows = await orders()
    .find(
      {
        updatedAt: { $gt: since },

        ...(userId
          ? { assignedUserId: userId }
          : {}),
      },
      { projection: ROW_PROJECTION }
    )
    .sort({ updatedAt: 1 })
    .limit(LIMIT + 1)
    .toArray();

  if (rows.length > LIMIT) {
    return null;
  }

  return rows.map((r) =>
    toRow(r as Record<string, unknown>)
  );
}

/**
 * Get full order details for the packing screen.
 *
 * userId is optional for existing callers.
 * When provided, only the assigned user's
 * order can be returned.
 */
export async function getPackingOrder(
  orderId: string,
  userId?: string
): Promise<PackingDetail | null> {
  const doc = await orders().findOne(
    {
      orderId,
      ...(userId
        ? { assignedUserId: userId }
        : {}),
    },
    {
      projection: {
        _id: 0,
        ownerUserId: 0,
        // Packing screens carry no customer information.
        customerId: 0,
        customerName: 0,
      },
    }
  );

  return doc
    ? toDetail(
        doc as unknown as Record<string, unknown>
      )
    : null;
}

/* -------------------------------------------------- */
/* Packing errors and actions                         */
/* -------------------------------------------------- */

export class PackingError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export const PACK_ACTIONS: PackAction[] = [
  "claim",
  "release",
  "packed",
  "unavailable",
  "restore",
  "resolve",
  "reopen",
];

const SUPERVISOR_ONLY = new Set<PackAction>([
  "restore",
  "resolve",
  "reopen",
]);

const person = (u: AuthUser): Person => ({
  id: u.userId,
  name: u.username,
});

/**
 * Atomic conditional order update.
 */
async function update(
  filter: Filter<OrderDoc>,
  change: UpdateFilter<OrderDoc>
) {
  const doc = await orders().findOneAndUpdate(
    filter,
    change,
    {
      returnDocument: "after",

      projection: {
        _id: 0,
        ownerUserId: 0,
        // Packing screens carry no customer information.
        customerId: 0,
        customerName: 0,
      },
    }
  );

  return doc
    ? toDetail(
        doc as unknown as Record<string, unknown>
      )
    : null;
}

/**
 * Explain why an order update was rejected.
 */
async function explain(
  orderId: string
): Promise<never> {
  const doc = await orders().findOne(
    { orderId },
    {
      projection: {
        progress: 1,
        packer: 1,
      },
    }
  );

  if (!doc) {
    throw new PackingError(
      "Order not found.",
      404
    );
  }

  if (
    doc.progress === "packing" &&
    doc.packer
  ) {
    throw new PackingError(
      `Being packed by ${doc.packer.name}.`,
      409
    );
  }

  throw new PackingError(
    `Order is ${progressLabel(
      doc.progress,
      "team"
    ).toLowerCase()}.`,
    409
  );
}

/* -------------------------------------------------- */
/* Packing actions                                    */
/* -------------------------------------------------- */

export async function runPackAction(
  user: AuthUser,
  orderId: string,
  action: PackAction,
  itemIndex?: number
): Promise<PackingDetail> {
  if (!can(user.role, "order:pack")) {
    throw new PackingError(
      "Forbidden",
      403
    );
  }

  const supervisor = can(
    user.role,
    "order:supervise"
  );

  if (
    SUPERVISOR_ONLY.has(action) &&
    !supervisor
  ) {
    throw new PackingError(
      "Forbidden",
      403
    );
  }

  const now = new Date();

  // Packers act on their own claim.
  // Supervisors may manage other claims.
  const mine: Filter<OrderDoc> = supervisor
    ? {}
    : { "packer.id": user.userId };

  const clearClaim = {
    packer: null,
    claimedAt: null,
  };

  let result: PackingDetail | null = null;

  switch (action) {
    /* ---------------------------------------------- */
    /* CLAIM ORDER - AUTOMATIC ASSIGNMENT + FIFO      */
    /* ---------------------------------------------- */

    case "claim": {
      try {
        await claimAssignedOrder(
          orderId,
          user.userId,
          user.username
        );

        result = await getPackingOrder(
          orderId,
          user.userId
        );

        if (!result) {
          throw new PackingError(
            "Order not found.",
            404
          );
        }
      } catch (error) {
        if (error instanceof ClaimError) {
          throw new PackingError(
            error.message,
            error.status
          );
        }

        throw error;
      }

      break;
    }

    /* ---------------------------------------------- */
    /* RELEASE ORDER                                  */
    /* ---------------------------------------------- */

    case "release": {
      result = await update(
        {
          orderId,
          progress: "packing",
          ...mine,
        },
        {
          $set: {
            progress: "ready",
            ...clearClaim,
            updatedAt: now,
          },
        }
      );

      break;
    }

    /* ---------------------------------------------- */
    /* MARK ORDER AS PACKED                           */
    /* ---------------------------------------------- */

    case "packed": {
      result = await update(
        {
          orderId,
          progress: "packing",
          ...mine,
        },
        {
          $set: {
            progress: "packed",
            ...clearClaim,

            packedBy: person(user),
            packedAt: now,

            updatedAt: now,
          },
        }
      );

      break;
    }

    /* ---------------------------------------------- */
    /* ITEM UNAVAILABLE                               */
    /* ---------------------------------------------- */

    case "unavailable": {
      if (
        !Number.isInteger(itemIndex) ||
        (itemIndex as number) < 0
      ) {
        throw new PackingError(
          "itemIndex is required.",
          400
        );
      }

      const i = itemIndex as number;

      const current = await orders().findOne(
        { orderId },
        {
          projection: {
            items: { $slice: [i, 1] },
          },
        }
      );

      if (!current) {
        throw new PackingError(
          "Order not found.",
          404
        );
      }

      const item = current.items?.[0];

      if (!item) {
        throw new PackingError(
          "Item not found.",
          404
        );
      }

      result = await update(
        {
          orderId,

          [`items.${i}.ItemCode`]:
            item.ItemCode,

          ...(supervisor
            ? {
                progress: {
                  $in: ["ready", "packing"],
                },
              }
            : {
                progress: "packing",
                "packer.id": user.userId,
                assignedUserId: user.userId,
              }),
        },
        {
          $set: {
            [`items.${i}.unavailable`]:
              true,

            progress: "on_hold",

            ...clearClaim,

            hold: {
              itemIndex: i,
              itemCode: item.ItemCode,
              by: person(user),
              at: now,
            },

            updatedAt: now,
          },
        }
      );

      break;
    }

    /* ---------------------------------------------- */
    /* RESTORE UNAVAILABLE ITEM                       */
    /* ---------------------------------------------- */

    case "restore": {
      result = await update(
        {
          orderId,
          progress: "on_hold",
        },
        {
          $set: {
            progress: "ready",
            hold: null,

            "items.$[].unavailable": false,

            updatedAt: now,
          },
        }
      );

      break;
    }

    /* ---------------------------------------------- */
    /* RESOLVE ORDER AGAIN                            */
    /* ---------------------------------------------- */

    case "resolve": {
      result = await update(
        {
          orderId,
          progress: "on_hold",
        },
        {
          $set: {
            progress: "submitted",
            hold: null,
            solvedAt: null,

            updatedAt: now,
          },
        }
      );

      break;
    }

    /* ---------------------------------------------- */
    /* REOPEN PACKED ORDER                            */
    /* ---------------------------------------------- */

    case "reopen": {
      result = await update(
        {
          orderId,
          progress: "packed",
        },
        {
          $set: {
            progress: "ready",

            packedBy: null,
            packedAt: null,

            updatedAt: now,
          },
        }
      );

      break;
    }
  }

  return result ?? explain(orderId);
}

/* -------------------------------------------------- */
/* Order edit and intake helpers                      */
/* -------------------------------------------------- */

type ComparableItem = Omit<
  PackingItem,
  "unavailable"
>;

/**
 * Check whether two sets of items are equivalent
 * for the solver.
 */
export function sameItems(
  a: ComparableItem[],
  b: ComparableItem[]
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (x, i) =>
        x.ItemCode === b[i].ItemCode &&
        x.ItemReference ===
          b[i].ItemReference &&
        x.Width === b[i].Width &&
        x.Length === b[i].Length &&
        x.Depth === b[i].Depth &&
        (x.BoxGroup ?? "") ===
          (b[i].BoxGroup ?? "")
    )
  );
}

/**
 * Prevent edits while an order is actively
 * being packed or is already packed.
 */
export const isLocked = (
  p?: OrderProgress
) =>
  p === "packing" ||
  p === "packed";

/**
 * Reset the solution when order items change.
 *
 * The order must be solved again before packing.
 */
export async function resetOrderSolution(
  orderId: string
): Promise<void> {
  const now = new Date();

  await orders().updateOne(
    { orderId },
    {
      $set: {
        progress: "submitted",

        solvedAt: null,
        hold: null,

        packer: null,
        claimedAt: null,

        // Clear previous assignment because
        // the order must be solved again.
        assignedUserId: null,
        assignedUserName: null,
        assignedAt: null,

        updatedAt: now,
      },
    }
  );
}
