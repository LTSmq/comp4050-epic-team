import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));

import type { AuthUser } from "@/lib/auth";
import { can, orderScope, requirePermission, requireUser, type Action, type Role } from "./rbac";

const user = (role: Role, userId = "u1"): AuthUser => ({
  userId,
  email: `${userId}@example.com`,
  username: userId,
  role,
});

describe("can", () => {
  const cases: Array<[Role, Action, boolean]> = [
    ["customer", "order:create", true],
    ["customer", "order:read", true],
    ["customer", "order:update", false],
    ["customer", "order:delete", false],
    ["customer", "order:pack", false],
    ["customer", "order:supervise", false],
    ["customer", "user:read", false],
    ["customer", "role:assign", false],
    ["team", "order:create", true],
    ["team", "order:read", true],
    ["team", "order:pack", true],
    ["team", "user:read", true],
    ["team", "order:update", false],
    ["team", "order:delete", false],
    ["team", "order:supervise", false],
    ["team", "role:assign", false],
    ["supervisor", "order:update", true],
    ["supervisor", "order:delete", true],
    ["supervisor", "order:supervise", true],
    ["supervisor", "role:assign", true],
  ];

  for (const [role, action, expected] of cases) {
    it(`${role} ${expected ? "can" : "cannot"} ${action}`, () => {
      expect(can(role, action)).toBe(expected);
    });
  }

  it("denies an unknown role", () => {
    expect(can("admin" as Role, "order:read")).toBe(false);
  });
});

describe("orderScope", () => {
  it("limits customers to their own orders, ignoring any requested customer", () => {
    expect(orderScope(user("customer", "c1"), "someone-else")).toEqual({ customerId: "c1" });
  });

  it("gives staff every order by default", () => {
    expect(orderScope(user("team"))).toEqual({});
    expect(orderScope(user("supervisor"))).toEqual({});
  });

  it("lets staff narrow to one customer", () => {
    expect(orderScope(user("supervisor"), "c9")).toEqual({ customerId: "c9" });
  });
});

describe("requireUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when nobody is logged in", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    const result = await requireUser();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns the logged-in user", async () => {
    const u = user("team");
    mocks.getAuthUser.mockResolvedValue(u);
    await expect(requireUser()).resolves.toEqual({ ok: true, user: u });
  });
});

describe("requirePermission", () => {
  it("returns null when allowed", () => {
    expect(requirePermission(user("supervisor"), "role:assign")).toBeNull();
  });

  it("returns 403 when not allowed", async () => {
    const response = requirePermission(user("customer"), "order:pack");
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "Forbidden" });
  });
});
