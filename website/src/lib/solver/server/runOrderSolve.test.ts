import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  markOrderProgress: vi.fn(),
  autoAssignOrder: vi.fn(),
  saveSolution: vi.fn(),
  fetch: vi.fn(),
}));

// Real order validation; only the database is faked.
vi.mock("@/lib/mongodb", () => ({
  default: { db: () => ({ collection: () => ({ findOne: mocks.findOne }) }) },
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/orders/markProgress", () => ({ markOrderProgress: mocks.markOrderProgress }));
vi.mock("@/lib/orders/autoAssign", () => ({ autoAssignOrder: mocks.autoAssignOrder }));
vi.mock("@/app/lib/solutionStore", () => ({ saveSolution: mocks.saveSolution }));

import { runOrderSolve } from "./runOrderSolve";

const savedOrder = {
  orderId: "PF-000001",
  source: "Manual",
  status: "Available",
  progress: "submitted",
  items: [
    { ItemCode: "A", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 350 },
    { ItemCode: "B", ItemReference: "Gone", Width: 50, Length: 50, Depth: 50, Weight: 100, unavailable: true },
  ],
};

const solved = {
  id: "solver-generated",
  packages: [
    { size: { x: 150, y: 150, z: 150 }, items: [{ itemCode: "A", itemReference: "Mug", unit: 1, position: { x: 0, y: 0, z: 0 }, size: { x: 120, y: 95, z: 100 } }] },
  ],
  unpacked: [],
};

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("runOrderSolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findOne.mockResolvedValue(savedOrder);
    mocks.fetch.mockResolvedValue(reply(200, solved));
    mocks.markOrderProgress.mockResolvedValue(undefined);
    mocks.autoAssignOrder.mockResolvedValue("pack1");
    mocks.saveSolution.mockResolvedValue(undefined);
  });

  it("solves, saves, assigns and marks the order ready", async () => {
    const result = await runOrderSolve("PF-000001");

    expect(result).toEqual({ ok: true, result: { ...solved, id: "PF-000001" } });
    expect(mocks.markOrderProgress.mock.calls.map((c) => c[1])).toEqual(["solving", "ready"]);
    expect(mocks.autoAssignOrder).toHaveBeenCalledWith("PF-000001");

    const [orderId, cartons, raw] = mocks.saveSolution.mock.calls[0];
    expect(orderId).toBe("PF-000001");
    expect(cartons).toEqual([expect.objectContaining({ boxReference: "SML", items: [expect.objectContaining({ itemCode: "A", weight: 0.35 })] })]);
    expect(raw).toMatchObject({ id: "PF-000001" });
  });

  it("sends only available items, in kg, with the carton catalogue", async () => {
    await runOrderSolve("PF-000001");
    const [, init] = mocks.fetch.mock.calls[0] as [string, { body: string; method: string }];
    const body = JSON.parse(init.body);
    expect(init.method).toBe("POST");
    expect(body.OrderId).toBe("PF-000001");
    expect(body.Items).toEqual([{ ItemCode: "A", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 0.35, BoxGroup: null }]);
    expect(body.BoxTypes.length).toBeGreaterThan(0);
  });

  it("applies the caller's access scope when loading the order", async () => {
    await runOrderSolve("PF-000001", { customerId: "c1" });
    expect(mocks.findOne).toHaveBeenCalledWith({ customerId: "c1", orderId: "PF-000001" });
  });

  it("returns 404 for a missing order", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(runOrderSolve("PF-404")).resolves.toEqual({ ok: false, status: 404, error: "Order not found" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("refuses to re-solve an order being packed or already packed", async () => {
    for (const progress of ["packing", "packed"]) {
      mocks.findOne.mockResolvedValue({ ...savedOrder, progress });
      await expect(runOrderSolve("PF-000001")).resolves.toMatchObject({ ok: false, status: 409 });
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when every item is unavailable", async () => {
    mocks.findOne.mockResolvedValue({ ...savedOrder, items: [savedOrder.items[1]] });
    await expect(runOrderSolve("PF-000001")).resolves.toEqual({ ok: false, status: 400, error: "No available items to pack." });
  });

  it("fails the order with the solver's own message when it refuses", async () => {
    mocks.fetch.mockResolvedValue(reply(400, { Error: "Nothing in the order could be packed" }));
    await expect(runOrderSolve("PF-000001")).resolves.toMatchObject({
      ok: false,
      status: 400,
      error: "Solver failed: Nothing in the order could be packed",
    });
    expect(mocks.markOrderProgress).toHaveBeenLastCalledWith("PF-000001", "failed");
    expect(mocks.saveSolution).not.toHaveBeenCalled();
  });

  it("never hands packers a partial layout", async () => {
    mocks.fetch.mockResolvedValue(
      reply(200, { ...solved, unpacked: [{ itemCode: "BIG", itemReference: "Cabinet", unit: 1, size: { x: 900, y: 600, z: 1800 }, weight: 45, reason: "TooLarge" }] })
    );
    await expect(runOrderSolve("PF-000001")).resolves.toMatchObject({
      ok: false,
      status: 422,
      error: "Solver could not fit: BIG (TooLarge)",
    });
    expect(mocks.markOrderProgress).toHaveBeenLastCalledWith("PF-000001", "failed");
    expect(mocks.saveSolution).not.toHaveBeenCalled();
    expect(mocks.autoAssignOrder).not.toHaveBeenCalled();
  });

  it("fails the order when the solver is unreachable", async () => {
    mocks.fetch.mockRejectedValue(new Error("fetch failed"));
    await expect(runOrderSolve("PF-000001")).resolves.toEqual({ ok: false, status: 500, error: "fetch failed" });
    expect(mocks.markOrderProgress).toHaveBeenLastCalledWith("PF-000001", "failed");
  });

  it("fails the order when the reply is malformed", async () => {
    mocks.fetch.mockResolvedValue(reply(200, { OrderId: "x", PackedBoxes: [] }));
    await expect(runOrderSolve("PF-000001")).resolves.toMatchObject({ ok: false, status: 500 });
    expect(mocks.markOrderProgress).toHaveBeenLastCalledWith("PF-000001", "failed");
  });

  it("keeps the saved solution if packer assignment fails, without marking it failed", async () => {
    mocks.autoAssignOrder.mockRejectedValue(new Error("No team members available for packing."));
    await expect(runOrderSolve("PF-000001")).resolves.toEqual({
      ok: false,
      status: 503,
      error: "Solution saved, but packer assignment failed: No team members available for packing.",
    });
    expect(mocks.saveSolution).toHaveBeenCalledOnce();
    expect(mocks.markOrderProgress.mock.calls.map((c) => c[1])).toEqual(["solving"]);
  });
});
