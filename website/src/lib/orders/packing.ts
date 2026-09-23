/**
 * Packing (server only): packing-list queries and every packing state change.
 * Each change is ONE atomic conditional update, so two packers can never
 * claim the same order — the second one gets a 409.
 */
import type { Filter, UpdateFilter } from "mongodb";
import client from "@/lib/mongodb";
import type { AuthUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  CLAIM_TTL_MS,
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

const dbName = process.env.MONGODB_DB || "fitvisualizer";

type OrderDoc = {
  orderId: string;
  items: PackingItem[];
  progress?: OrderProgress;
  customerName?: string;
  packer?: Person | null;
  claimedAt?: Date | null;
  packedBy?: Person | null;
  packedAt?: Date | null;
  hold?: { itemIndex: number; itemCode: string; by: Person; at: Date } | null;
  solvedAt?: Date | null;
  updatedAt?: Date;
};

const orders = () => client.db(dbName).collection<OrderDoc>("orders");

/** Slim row: item COUNT computed in the DB, items never sent to the list. */
const ROW_PROJECTION = {
  _id: 0,
  orderId: 1,
  customerName: 1,
  progress: 1,
  itemCount: { $size: { $ifNull: ["$items", []] } },
  packer: 1,
  claimedAt: 1,
  packedBy: 1,
  packedAt: 1,
  "hold.itemCode": 1,
  solvedAt: 1,
  updatedAt: 1,
} as const;

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

function toRow(raw: Record<string, unknown>): PackingRow {
  const items = raw.items as unknown[] | undefined;
  const hold = raw.hold as { itemCode?: string } | null | undefined;
  return {
    orderId: String(raw.orderId),
    customerName: (raw.customerName as string) ?? "Unassigned",
    progress: ORDER_PROGRESS.includes(raw.progress as OrderProgress)
      ? (raw.progress as OrderProgress)
      : "submitted",
    itemCount: typeof raw.itemCount === "number" ? raw.itemCount : items?.length ?? 0,
    packer: (raw.packer as Person) ?? null,
    claimedAt: iso(raw.claimedAt),
    packedBy: (raw.packedBy as Person) ?? null,
    packedAt: iso(raw.packedAt),
    holdItemCode: hold?.itemCode ?? null,
    solvedAt: iso(raw.solvedAt),
    updatedAt: iso(raw.updatedAt),
  };
}

function toDetail(raw: Record<string, unknown>): PackingDetail {
  return { ...toRow(raw), items: Array.isArray(raw.items) ? (raw.items as PackingItem[]) : [] };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

const LIMIT = 500;

/** Full packing list: ready / packing / on hold, plus recently packed. Oldest first. */
export async function listPackingOrders(now = new Date()): Promise<PackingRow[]> {
  const rows = await orders()
    .find(
      {
        $or: [
          { progress: { $in: ["ready", "packing", "on_hold"] } },
          { progress: "packed", packedAt: { $gte: new Date(now.getTime() - PACKED_WINDOW_MS) } },
        ],
      },
      { projection: ROW_PROJECTION }
    )
    .sort({ solvedAt: 1, orderId: 1 })
    .limit(LIMIT)
    .toArray();
  return rows.map((r) => toRow(r as Record<string, unknown>));
}

/** Only orders changed after `since` (any state). null = too many, send the full list. */
export async function listPackingChanges(since: Date): Promise<PackingRow[] | null> {
  const rows = await orders()
    .find({ updatedAt: { $gt: since } }, { projection: ROW_PROJECTION })
    .sort({ updatedAt: 1 })
    .limit(LIMIT + 1)
    .toArray();
  if (rows.length > LIMIT) return null;
  return rows.map((r) => toRow(r as Record<string, unknown>));
}

export async function getPackingOrder(orderId: string): Promise<PackingDetail | null> {
  const doc = await orders().findOne({ orderId }, { projection: { _id: 0, ownerUserId: 0 } });
  return doc ? toDetail(doc as unknown as Record<string, unknown>) : null;
}

/* ------------------------------------------------------------------ */
/* State changes                                                       */
/* ------------------------------------------------------------------ */

export class PackingError extends Error {
  constructor(message: string, public status: number) {
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
const SUPERVISOR_ONLY: PackAction[] = ["restore", "resolve", "reopen"];

const person = (u: AuthUser): Person => ({ id: u.userId, name: u.username });

async function update(filter: Filter<OrderDoc>, change: UpdateFilter<OrderDoc>) {
  const doc = await orders().findOneAndUpdate(filter, change, {
    returnDocument: "after",
    projection: { _id: 0, ownerUserId: 0 },
  });
  return doc ? toDetail(doc as unknown as Record<string, unknown>) : null;
}

/** Turn a failed conditional update into a message the packer understands. */
async function explain(orderId: string): Promise<never> {
  const doc = await orders().findOne({ orderId }, { projection: { progress: 1, packer: 1 } });
  if (!doc) throw new PackingError("Order not found.", 404);
  if (doc.progress === "packing" && doc.packer) {
    throw new PackingError(`Being packed by ${doc.packer.name}.`, 409);
  }
  throw new PackingError(`Order is ${progressLabel(doc.progress, "team").toLowerCase()}.`, 409);
}

export async function runPackAction(
  user: AuthUser,
  orderId: string,
  action: PackAction,
  itemIndex?: number
): Promise<PackingDetail> {
  if (!can(user.role, "order:pack")) throw new PackingError("Forbidden", 403);
  const supervisor = can(user.role, "order:supervise");
  if (SUPERVISOR_ONLY.includes(action) && !supervisor) throw new PackingError("Forbidden", 403);

  const now = new Date();
  const staleBefore = new Date(now.getTime() - CLAIM_TTL_MS);
  // Packers act on their own claim; supervisors on anyone's.
  const mine: Filter<OrderDoc> = supervisor ? {} : { "packer.id": user.userId };
  const clearClaim = { packer: null, claimedAt: null };
  let result: PackingDetail | null = null;

  switch (action) {
    case "claim": {
      // One active order per packer.
      const other = await orders().findOne(
        {
          "packer.id": user.userId,
          progress: "packing",
          claimedAt: { $gte: staleBefore },
          orderId: { $ne: orderId },
        },
        { projection: { orderId: 1 } }
      );
      if (other) throw new PackingError(`Finish or release order ${other.orderId} first.`, 409);

      result = await update(
        {
          orderId,
          $or: [
            { progress: "ready" },
            { progress: "packing", claimedAt: { $lt: staleBefore } }, // abandoned
            { progress: "packing", "packer.id": user.userId }, // double tap
          ],
        },
        { $set: { progress: "packing", packer: person(user), claimedAt: now, updatedAt: now } }
      );
      break;
    }

    case "release":
      result = await update(
        { orderId, progress: "packing", ...mine },
        { $set: { progress: "ready", ...clearClaim, updatedAt: now } }
      );
      break;

    case "packed":
      result = await update(
        { orderId, progress: "packing", ...mine },
        { $set: { progress: "packed", ...clearClaim, packedBy: person(user), packedAt: now, updatedAt: now } }
      );
      break;

    case "unavailable": {
      if (!Number.isInteger(itemIndex) || (itemIndex as number) < 0) {
        throw new PackingError("itemIndex is required.", 400);
      }
      const i = itemIndex as number;
      const current = await orders().findOne({ orderId }, { projection: { items: { $slice: [i, 1] } } });
      if (!current) throw new PackingError("Order not found.", 404);
      const item = current.items?.[0];
      if (!item) throw new PackingError("Item not found.", 404);

      result = await update(
        {
          orderId,
          [`items.${i}.ItemCode`]: item.ItemCode,
          ...(supervisor
            ? { progress: { $in: ["ready", "packing"] } }
            : { progress: "packing", "packer.id": user.userId }),
        },
        {
          $set: {
            [`items.${i}.unavailable`]: true,
            progress: "on_hold",
            ...clearClaim,
            hold: { itemIndex: i, itemCode: item.ItemCode, by: person(user), at: now },
            updatedAt: now,
          },
        }
      );
      break;
    }

    case "restore": // item found after all
      result = await update(
        { orderId, progress: "on_hold" },
        { $set: { progress: "ready", hold: null, "items.$[].unavailable": false, updatedAt: now } }
      );
      break;

    case "resolve": // send back to the solver without the item
      result = await update(
        { orderId, progress: "on_hold" },
        { $set: { progress: "submitted", hold: null, solvedAt: null, updatedAt: now } }
      );
      break;

    case "reopen": // undo "packed"
      result = await update(
        { orderId, progress: "packed" },
        { $set: { progress: "ready", packedBy: null, packedAt: null, updatedAt: now } }
      );
      break;
  }

  return result ?? explain(orderId);
}

/* ------------------------------------------------------------------ */
/* Used by order edit (PUT) and order intake                           */
/* ------------------------------------------------------------------ */

type ComparableItem = Omit<PackingItem, "unavailable">;

/** Same items in every field the solver uses? */
export function sameItems(a: ComparableItem[], b: ComparableItem[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (x, i) =>
        x.ItemCode === b[i].ItemCode &&
        x.ItemReference === b[i].ItemReference &&
        x.Width === b[i].Width &&
        x.Length === b[i].Length &&
        x.Depth === b[i].Depth &&
        (x.BoxGroup ?? "") === (b[i].BoxGroup ?? "")
    )
  );
}

/** Warehouse is working on it — contents may not change. */
export const isLocked = (p?: OrderProgress) => p === "packing" || p === "packed";

/** Items changed: old 3D layout is wrong. Back to "submitted" so it gets solved again. */
export async function resetOrderSolution(orderId: string): Promise<void> {
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
        updatedAt: now,
      },
    }
  );
}
