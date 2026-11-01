import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  packers: [] as Array<{ _id: { toString(): string }; username: string }>,
  counts: [] as Array<{ _id: string; count: number }>,
  assignResult: { modifiedCount: 1 },
  lockResult: { matchedCount: 1 },
  ordersUpdateOne: vi.fn(),
  locksUpdateOne: vi.fn(),
  aggregate: vi.fn(),
  endSession: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => {
  const collection = (name: string) => {
    if (name === "packingLocks") return { updateOne: mocks.locksUpdateOne };
    if (name === "users") return { find: () => ({ toArray: async () => mocks.packers }) };
    return {
      findOne: async () => mocks.order,
      aggregate: mocks.aggregate,
      updateOne: mocks.ordersUpdateOne,
    };
  };
  return {
    default: {
      db: () => ({ collection }),
      startSession: () => ({
        withTransaction: async (callback: () => Promise<unknown>) => callback(),
        endSession: mocks.endSession,
      }),
    },
  };
});

import { autoAssignOrder } from "./autoAssign";

const packer = (id: string, username: string) => ({ _id: { toString: () => id }, username });

describe("autoAssignOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order = { orderId: "PF-000001", assignedUserId: null };
    mocks.packers = [packer("a", "pack1"), packer("b", "pack2"), packer("c", "pack3")];
    mocks.counts = [];
    mocks.locksUpdateOne.mockImplementation(async () => mocks.lockResult);
    mocks.ordersUpdateOne.mockImplementation(async () => mocks.assignResult);
    mocks.aggregate.mockImplementation(() => ({ toArray: async () => mocks.counts }));
    mocks.assignResult = { modifiedCount: 1 };
    mocks.lockResult = { matchedCount: 1 };
  });

  it("assigns the packer with the fewest open orders", async () => {
    mocks.counts = [
      { _id: "a", count: 3 },
      { _id: "b", count: 1 },
      { _id: "c", count: 2 },
    ];
    await expect(autoAssignOrder("PF-000001")).resolves.toBe("b");

    const [filter, update] = mocks.ordersUpdateOne.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { $set: Record<string, unknown> },
    ];
    expect(filter).toEqual({ orderId: "PF-000001", assignedUserId: { $in: [null, ""] } });
    expect(update.$set).toMatchObject({ assignedUserId: "b", assignedUserName: "pack2", assignedAt: expect.any(Date) });
  });

  it("treats packers with no open orders as zero and breaks ties by user id", async () => {
    mocks.counts = [{ _id: "a", count: 1 }];
    await expect(autoAssignOrder("PF-000001")).resolves.toBe("b");
  });

  it("only counts unfinished orders as workload", async () => {
    await autoAssignOrder("PF-000001");
    const pipeline = mocks.aggregate.mock.calls[0][0] as Array<{ $match?: { progress: { $in: string[] } } }>;
    expect(pipeline[0].$match?.progress.$in).toEqual(["solving", "ready", "packing", "on_hold"]);
  });

  it("keeps an existing assignment", async () => {
    mocks.order = { orderId: "PF-000001", assignedUserId: "c" };
    await expect(autoAssignOrder("PF-000001")).resolves.toBe("c");
    expect(mocks.ordersUpdateOne).not.toHaveBeenCalled();
  });

  it("fails when the order does not exist", async () => {
    mocks.order = null;
    await expect(autoAssignOrder("PF-404")).rejects.toThrow("Order PF-404 not found.");
  });

  it("fails when there are no team members", async () => {
    mocks.packers = [];
    await expect(autoAssignOrder("PF-000001")).rejects.toThrow("No team members available for packing.");
  });

  it("reports a conflict if the order was assigned concurrently", async () => {
    mocks.assignResult = { modifiedCount: 0 };
    await expect(autoAssignOrder("PF-000001")).rejects.toThrow("Order assignment conflict. Please retry.");
  });

  it("takes the shared allocation lock and always ends the session", async () => {
    await autoAssignOrder("PF-000001");
    expect(mocks.locksUpdateOne).toHaveBeenCalledWith(
      { _id: "allocation" },
      { $inc: { version: 1 } },
      expect.objectContaining({ session: expect.anything() })
    );
    mocks.packers = [];
    await expect(autoAssignOrder("PF-000001")).rejects.toThrow();
    expect(mocks.endSession).toHaveBeenCalledTimes(2);
  });

  it("fails if the allocation lock document is missing", async () => {
    mocks.lockResult = { matchedCount: 0 };
    await expect(autoAssignOrder("PF-000001")).rejects.toThrow("Packing allocation lock not found.");
  });
});
