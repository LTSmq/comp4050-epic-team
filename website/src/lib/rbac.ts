import { NextResponse } from "next/server";
import { getAuthUser, type AuthUser } from "./auth";

export type Role = "customer" | "team" | "supervisor";

export type Action =
  | "order:create"
  | "order:read"
  | "order:update"
  | "order:delete"
  | "order:pack" // claim / release / mark packed / mark item unavailable
  | "order:supervise" // override packers, resolve holds, undo packed
  | "user:read" // list users (emails)
  | "role:assign";

const PERMISSIONS: Record<Role, Set<Action>> = {
  customer: new Set<Action>(["order:create", "order:read"]),
  // Packers: read and pack only. No creating or editing orders.
  team: new Set<Action>([ "order:create", "order:read", "order:pack", "user:read"]),
  supervisor: new Set<Action>([
    "order:create",
    "order:read",
    "order:update",
    "order:delete",
    "order:pack",
    "order:supervise",
    "user:read",
    "role:assign",
  ]),
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[role]?.has(action) ?? false;
}

/**
 * Mongo filter limiting which orders a user may read.
 * - customer: only orders where they are the customer
 * - team / supervisor: all orders, optionally narrowed to one customer
 */
export function orderScope(
  user: AuthUser,
  customerId?: string | null
): Record<string, unknown> {
  if (user.role === "customer") {
    return { customerId: user.userId };
  }
  return customerId ? { customerId } : {};
}

/** Resolve the session, or return a 401 response. */
type RequireUserResult = { ok: true; user: AuthUser } | { ok: false; response: NextResponse };

export async function requireUser(): Promise<RequireUserResult> {
  const user = await getAuthUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

/** Return a 403 response if the user lacks the permission, else null. */
export function requirePermission(
  user: AuthUser,
  action: Action
): NextResponse | null {
  if (!can(user.role, action)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
