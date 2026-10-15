
export type OrderProgress =
  | "submitted"
  | "solving"
  | "ready"
  | "packing"
  | "packed"
  | "on_hold"
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

export type ViewerRole =
  | "customer"
  | "team"
  | "supervisor";

/**
 * Same underlying value, different label per role.
 * Customers see only Submitted or Packed.
 * Staff see the precise state.
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

/* -------------------------------------------------- */
/* Packing list types and helpers                     */
/* -------------------------------------------------- */

/** Claim expiry: 30 minutes */
export const CLAIM_TTL_MS = 30 * 60 * 1000;

/** Packed orders remain visible for 12 hours */
export const PACKED_WINDOW_MS = 12 * 60 * 60 * 1000;

export type Person = {
  id: string;
  name: string;
};

/**
 * One row in the packing list.
 * All dates are ISO strings.
 */
export type PackingRow = {
  orderId: string;
  customerName: string;
  progress: OrderProgress;
  itemCount: number;

  // Automatic assignment
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedAt?: string | null;

  // Packing information
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

export type PackingDetail = PackingRow & {
  items: PackingItem[];
};

export type PackAction =
  | "claim"
  | "release"
  | "packed"
  | "unavailable"
  | "restore"
  | "resolve"
  | "reopen";

/**
 * Determine whether a packing claim has expired.
 */
export function isClaimStale(
  row: Pick<PackingRow, "progress" | "claimedAt">,
  nowMs: number
): boolean {
  if (
    row.progress !== "packing" ||
    !row.claimedAt
  ) {
    return false;
  }

  return (
    nowMs - Date.parse(row.claimedAt) >
    CLAIM_TTL_MS
  );
}

/**
 * Display relative time:
 * just now, 4m, 2h, 3d
 */
export function formatAge(
  iso: string | null,
  nowMs: number
): string {
  if (!iso) return "";

  const m = Math.floor(
    Math.max(0, nowMs - Date.parse(iso)) /
      60000
  );

  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;

  const h = Math.floor(m / 60);

  return h < 24
    ? `${h}h`
    : `${Math.floor(h / 24)}d`;
}
