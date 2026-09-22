export type OrderProgress = "submitted" | "solving" | "ready" | "failed";

export const ORDER_PROGRESS: OrderProgress[] = [
  "submitted",
  "solving",
  "ready",
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
    return p === "ready" ? "Ready" : "Submitted";
  }

  switch (p) {
    case "solving":
      return "Solving";
    case "ready":
      return "3D Ready";
    case "failed":
      return "Failed";
    case "submitted":
    default:
      return "Submitted";
  }
}