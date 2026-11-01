import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateOne: vi.fn() }));

vi.mock("@/lib/mongodb", () => ({
  default: { db: () => ({ collection: () => ({ updateOne: mocks.updateOne }) }) },
}));

import { markOrderProgress } from "./markProgress";

type UpdateCall = [Record<string, unknown>, Array<{ $set: Record<string, unknown> }>];
const lastCall = () => mocks.updateOne.mock.calls[0] as unknown as UpdateCall;

describe("markOrderProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("protects orders being packed from solver updates", async () => {
    for (const progress of ["solving", "failed"] as const) {
      mocks.updateOne.mockClear();
      await markOrderProgress("PF-000001", progress);
      const [filter, update] = lastCall();
      expect(filter).toEqual({ orderId: "PF-000001", progress: { $nin: ["packing", "packed", "on_hold"] } });
      expect(update[0].$set.progress).toBe(progress);
    }
  });

  it("only marks an order ready when a packer is assigned, keeping the first solvedAt", async () => {
    await markOrderProgress("PF-000002", "ready");
    const [filter, update] = lastCall();
    expect(filter).toMatchObject({
      orderId: "PF-000002",
      progress: { $nin: ["packing", "packed", "on_hold"] },
      assignedUserId: { $exists: true, $nin: [null, ""] },
    });
    expect(update[0].$set.progress).toBe("ready");
    expect(update[0].$set.solvedAt).toMatchObject({ $ifNull: ["$solvedAt", expect.any(Date)] });
  });

  it("does not guard packing-side transitions", async () => {
    await markOrderProgress("PF-000003", "packed");
    const [filter, update] = lastCall();
    expect(filter).toEqual({ orderId: "PF-000003" });
    expect(update[0].$set).toEqual({ progress: "packed", updatedAt: expect.any(Date) });
  });

  it("throws when no order matched", async () => {
    mocks.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(markOrderProgress("PF-404", "ready")).rejects.toThrow("Cannot update order PF-404 to ready.");
  });
});
