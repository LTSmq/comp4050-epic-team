
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  find: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  default: {
    db: () => ({
      collection: (name: string) => {
        if (name === "packingLocks") {
          return { updateOne: mocks.updateOne };
        }

        return {
          findOne: mocks.findOne,
          find: mocks.find,
          updateOne: mocks.updateOne,
        };
      },
    }),
    startSession: () => ({
      withTransaction: mocks.withTransaction,
      endSession: mocks.endSession,
    }),
  },
}));

import { claimAssignedOrder } from "./claimAssigned";

describe("claimAssignedOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.withTransaction.mockImplementation(
      async (callback: () => Promise<unknown>) => callback()
    );

    mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.endSession.mockResolvedValue(undefined);
  });

  it("rejects a worker claiming another worker's order", async () => {
    mocks.findOne.mockResolvedValueOnce({
      orderId: "ORD-123",
      assignedUserId: "worker-2",
      progress: "ready",
    });

    await expect(
      claimAssignedOrder("ORD-123", "worker-1", "Worker One")
    ).rejects.toMatchObject({
      name: "ClaimError",
      message: "This order is assigned to another packer.",
      status: 403,
    });

    expect(mocks.findOne).toHaveBeenCalledTimes(1);
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });
});
