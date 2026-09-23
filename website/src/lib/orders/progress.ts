export type OrderProgress =
  | "submitted"
  | "solving"
  | "ready"
  | "packing" // a packer has claimed it
  | "packed" // done
  | "on_hold" // an item was marked unavailable; supervisor decides
  | "failed";

export const ORDER_PROGRESS: OrderProgress[] = [
  "submitted",
  "solving",
  "ready",
  "packing",
  "packed",
  "on_hold",
  "failed",
];

export type ViewerRole = "customer" | "team" | "supervisor";

/**
 * Same underlying value, different label per role.
 * Customers never see warehouse internals ("solving"/"failed") — only that the
 * order is in and, eventually, ready. Staff see the precise state.
 */
export function progressLabel(
  progress: OrderProgress | undefined,
  role: ViewerRole
): string {
  const p = progress ?? "submitted";

  if (role === "customer") {
    return p === "packed" ? "Packed" : "Submitted";
  }

  switch (p) {
    case "solving":
      return "Solving";
    case "ready":
      return "3D Ready";
    case "packing":
      return "Packing";
    case "packed":
      return "Packed";
    case "on_hold":
      return "On hold";
    case "failed":
      return "Failed";
    case "submitted":
    default:
      return "Submitted";
  }
}

/* ------------------------------------------------------------------ */
/* Packing list (client-safe types + helpers)                          */
/* ------------------------------------------------------------------ */

/** A claim older than this is treated as abandoned and can be taken over. */
export const CLAIM_TTL_MS = 30 * 60 * 1000;

/** How long packed orders stay visible on the packing list. */
export const PACKED_WINDOW_MS = 12 * 60 * 60 * 1000;

export type Person = { id: string; name: string };

/** One row of the packing list. Dates are ISO strings. */
export type PackingRow = {
  orderId: string;
  customerName: string;
  progress: OrderProgress;
  itemCount: number;
  packer: Person | null;
  claimedAt: string | null;
  packedBy: Person | null;
  packedAt: string | null;
  holdItemCode: string | null;
  solvedAt: string | null;
  updatedAt: string | null;
};

export type PackingItem = {
  ItemCode: string;
  ItemReference: string;
  Width: number;
  Length: number;
  Depth: number;
  BoxGroup?: string;
  unavailable?: boolean;
};

export type PackingDetail = PackingRow & { items: PackingItem[] };

export type PackAction =
  | "claim" // ready -> packing (me)
  | "release" // packing -> ready
  | "packed" // packing -> packed
  | "unavailable" // packing -> on_hold (itemIndex)
  | "restore" // on_hold -> ready            (supervisor)
  | "resolve" // on_hold -> submitted, re-solve (supervisor)
  | "reopen"; // packed -> ready             (supervisor)

export function isClaimStale(row: Pick<PackingRow, "progress" | "claimedAt">, nowMs: number) {
  if (row.progress !== "packing" || !row.claimedAt) return false;
  return nowMs - Date.parse(row.claimedAt) > CLAIM_TTL_MS;
}

/** "just now", "4m", "2h", "3d" relative to the server clock. */
export function formatAge(iso: string | null, nowMs: number): string {
  if (!iso) return "";
  const m = Math.floor(Math.max(0, nowMs - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}
