import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  markOrderProgress: vi.fn(),
  saveSolution: vi.fn(),
  getSolution: vi.fn(),
  listSolutions: vi.fn(),
  orders: { findOne: vi.fn(), find: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/mongodb", () => ({ default: { db: () => ({ collection: () => mocks.orders }) } }));
vi.mock("@/lib/orders/markProgress", () => ({ markOrderProgress: mocks.markOrderProgress }));
vi.mock("@/app/lib/solutionStore", () => ({
  saveSolution: mocks.saveSolution,
  getSolution: mocks.getSolution,
  listSolutions: mocks.listSolutions,
}));

import { GET, POST } from "./route";

const KEY = "solver-key";
const as = (role: string, userId = "u1") => mocks.getAuthUser.mockResolvedValue({ userId, username: "u", email: "x@x.com", role });
const stored = { orderId: "PF-000001", cartons: [{ boxIndex: 0 }], receivedAt: "2026-11-01T10:00:00.000Z", raw: {} };
const order = {
  orderId: "PF-000001",
  source: "Manual",
  status: "Available",
  items: [{ ItemCode: "A", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 350 }],
};
const solution = {
  id: "PF-000001",
  packages: [
    { size: { x: 150, y: 150, z: 150 }, items: [{ itemCode: "A", itemReference: "Mug", unit: 1, position: { x: 0, y: 0, z: 0 }, size: { x: 120, y: 95, z: 100 } }] },
  ],
  unpacked: [],
};
const push = (body: unknown, key: string | null = KEY) =>
  POST(new Request("http://localhost/api/solutions", { method: "POST", headers: key ? { "x-api-key": key } : {}, body: JSON.stringify(body) }));
const read = (query: string) => GET(new Request(`http://localhost/api/solutions${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SOLVER_API_KEY", KEY);
  mocks.orders.findOne.mockResolvedValue(order);
  mocks.getSolution.mockResolvedValue(stored);
  mocks.markOrderProgress.mockResolvedValue(undefined);
});

describe("POST /api/solutions (solver pushes a solution)", () => {
  it("requires the solver API key", async () => {
    expect((await push(solution, null)).status).toBe(401);
    expect((await push(solution, "wrong")).status).toBe(401);
  });

  it("saves cartons with weights restored and marks the order ready", async () => {
    expect(await (await push(solution)).json()).toEqual({ success: true });
    const [orderId, cartons] = mocks.saveSolution.mock.calls[0];
    expect(orderId).toBe("PF-000001");
    expect(cartons[0]).toMatchObject({ boxReference: "SML", items: [expect.objectContaining({ weight: 0.35 })] });
    expect(mocks.markOrderProgress).toHaveBeenCalledWith("PF-000001", "ready");
  });

  it("rejects a malformed solution with the problem's location", async () => {
    const response = await push({ id: "PF-000001", packages: [{ size: { x: 0, y: 1, z: 1 }, items: [] }] });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ path: "packages[0].size.x" });
  });

  it("returns 404 for an unknown order", async () => {
    mocks.orders.findOne.mockResolvedValue(null);
    expect((await push(solution)).status).toBe(404);
  });

  it("fails the order instead of saving a partial layout", async () => {
    const response = await push({ ...solution, unpacked: [{ itemCode: "BIG", itemReference: "x", unit: 1, size: { x: 1, y: 1, z: 1 }, weight: 1, reason: "TooLarge" }] });
    expect(response.status).toBe(422);
    expect(mocks.markOrderProgress).toHaveBeenCalledWith("PF-000001", "failed");
    expect(mocks.saveSolution).not.toHaveBeenCalled();
  });
});

describe("GET /api/solutions (visualiser reads)", () => {
  it("requires a login", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    expect((await read("?orderId=PF-000001")).status).toBe(401);
  });

  it("returns a solution within the reader's scope", async () => {
    as("team", "pack1");
    const response = await read("?orderId=PF-000001");
    expect(mocks.orders.findOne.mock.calls[0][0]).toEqual({ assignedUserId: "pack1", orderId: "PF-000001" });
    expect(await response.json()).toEqual({ orderId: "PF-000001", cartons: [{ boxIndex: 0 }], receivedAt: "2026-11-01T10:00:00.000Z" });
  });

  it("scopes customers to their own orders and supervisors to all", async () => {
    as("customer", "c1");
    await read("?orderId=PF-000001");
    as("supervisor");
    await read("?orderId=PF-000001");
    expect(mocks.orders.findOne.mock.calls.map((c) => c[0])).toEqual([
      { customerId: "c1", orderId: "PF-000001" },
      { orderId: "PF-000001" },
    ]);
  });

  it("reports 404 for orders outside the scope, so IDs cannot be probed", async () => {
    as("team");
    mocks.orders.findOne.mockResolvedValue(null);
    expect((await read("?orderId=PF-999999")).status).toBe(404);
    expect(mocks.getSolution).not.toHaveBeenCalled();
  });

  it("does not give customers the latest or full list", async () => {
    as("customer");
    expect((await read("?latest=true")).status).toBe(403);
    expect((await read("")).status).toBe(403);
  });

  it("gives staff the newest solved order in their scope", async () => {
    as("team", "pack1");
    const chain = { sort: () => chain, limit: () => chain, next: async () => ({ orderId: "PF-000001" }) };
    mocks.orders.find.mockReturnValue(chain);
    const body = await (await read("?latest=true")).json();
    expect(mocks.orders.find.mock.calls[0][0]).toEqual({ assignedUserId: "pack1", solvedAt: { $ne: null } });
    expect(body.orderId).toBe("PF-000001");
  });

  it("only lets supervisors list everything", async () => {
    as("team");
    expect((await read("")).status).toBe(403);
    as("supervisor");
    mocks.listSolutions.mockReturnValue([{ orderId: "PF-000001" }]);
    expect(await (await read("")).json()).toEqual({ success: true, solutions: [{ orderId: "PF-000001" }] });
  });
});
