import type { AuthUser } from "@/lib/auth";

// ---- 1. Every discrete thing the system can do is a capability ----
export type Capability =
  | "order:create"
  | "order:view:own"
  | "order:view:all"
  | "order:edit:own"      // own order, and only while still editable (see canEditOrder)
  | "order:edit:any"
  | "order:solve"
  | "result:view"         // open the 3D packing result
  | "user:manage";        // list users, change roles

// ---- 2. Every role the system supports ----
export type Role = "external" | "warehouse" | "supervisor";

// ---- 3. A role is just a bundle of capabilities. This table IS the model. ----
const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  external: ["order:create", "order:view:own", "order:edit:own", "result:view"],
  warehouse: ["order:view:all", "result:view"],
  supervisor: [
    "order:create", "order:view:own", "order:view:all",
    "order:edit:own", "order:edit:any", "order:solve",
    "result:view", "user:manage",
  ],
};

// unknown/legacy roles fall back to the least-privileged role
const DEFAULT_ROLE: Role = "external";

function roleOf(user: AuthUser | null): Role | null {
  if (!user) return null;
  return (user.role in ROLE_CAPABILITIES ? user.role : DEFAULT_ROLE) as Role;
}

// ---- 4. The only function the rest of the app calls ----
export function can(user: AuthUser | null, capability: Capability): boolean {
  const role = roleOf(user);
  if (!role) return false;
  return ROLE_CAPABILITIES[role].includes(capability);
}

// ---- 5. Context-dependent rule: "own order, only while editable" ----
export function canEditOrder(
  user: AuthUser | null,
  order: { userId?: string | { toString(): string }; status?: string }
): boolean {
  if (!user) return false;
  if (can(user, "order:edit:any")) return true;                 // supervisor: any order
  if (!can(user, "order:edit:own")) return false;               // warehouse: no edit at all
  const ownerId = order.userId?.toString();
  return ownerId === user.userId && order.status === "submitted"; // owner, still open
}

// helper for the UI, so it can show "you can see everything" vs "your orders"
export function canViewAllOrders(user: AuthUser | null): boolean {
  return can(user, "order:view:all");
}