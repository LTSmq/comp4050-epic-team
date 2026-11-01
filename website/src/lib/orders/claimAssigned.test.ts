import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  lockUpdateOne: vi.fn(),
  oldest: vi.fn(),
  find: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  default: {
    db: () => ({
      collection: (name: string) =>
        name === "packingLocks"
          ? { updateOne: mocks.lockUpdateOne }
          : { findOne: mocks.findOne, find: mocks.find, updateOne: mocks.updateOne },
    }),
    startSession: () => ({ withTransaction: mocks.withTransaction, endSession: mocks.endSession }),
  },
}));

import { ClaimError, claimAssignedOrder } from "./claimAssigned";

const readyOrder = { orderId: "PF-000001", assignedUserId: "worker-1", progress: "ready" };

describe("claimAssignedOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTransaction.mockImplementation(async (callback: () => Promise<unknown>) => callback());
    mocks.lockUpdateOne.mockResolvedValue({});
    mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.endSession.mockResolvedValue(undefined);
    mocks.find.mockReturnValue({ sort: () => ({ limit: () => ({ next: mocks.oldest }) }) });
    mocks.oldest.mockResolvedValue(readyOrder);
  });

  it("rejects a worker claiming another worker's order", async () => {
    mocks.findOne.mockResolvedValueOnce({ ...readyOrder, assignedUserId: "worker-2" });

    await expect(claimAssignedOrder("PF-000001", "worker-1", "Worker One")).rejects.toMatchObject({
      name: "ClaimError",
      message: "This order is assigned to another packer.",
      status: 403,
    });
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it("returns 404 for a missing order", async () => {
    mocks.findOne.mockResolvedValueOnce(null);
    await expect(claimAssignedOrder("PF-404", "worker-1", "W")).rejects.toMatchObject({ status: 404 });
  });

  it("claims the oldest ready order and records the packer", async () => {
    mocks.findOne.mockResolvedValueOnce(readyOrder).mockResolvedValueOnce(null);

    await claimAssignedOrder("PF-000001", "worker-1", "Worker One");

    const [filter, update] = mocks.updateOne.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { $set: Record<string, unknown> },
    ];
    expect(filter).toMatchObject({ orderId: "PF-000001", assignedUserId: "worker-1" });
    expect(update.$set).toMatchObject({
      progress: "packing",
      packer: { id: "worker-1", name: "Worker One" },
      claimedAt: expect.any(Date),
    });
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it("is idempotent when the packer already has this order", async () => {
    mocks.findOne.mockResolvedValueOnce(readyOrder).mockResolvedValueOnce({ orderId: "PF-000001" });
    await expect(claimAssignedOrder("PF-000001", "worker-1", "W")).resolves.toBeUndefined();
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("allows only one active order per packer", async () => {
    mocks.findOne.mockResolvedValueOnce(readyOrder).mockResolvedValueOnce({ orderId: "PF-000009" });
    await expect(claimAssignedOrder("PF-000001", "worker-1", "W")).rejects.toMatchObject({
      message: "Finish order PF-000009 first.",
      status: 409,
    });
  });

  it("enforces FIFO: the oldest ready order must be packed first", async () => {
    mocks.findOne.mockResolvedValueOnce(readyOrder).mockResolvedValueOnce(null);
    mocks.oldest.mockResolvedValue({ orderId: "PF-000000" });
    await expect(claimAssignedOrder("PF-000001", "worker-1", "W")).rejects.toMatchObject({
      message: "Pack order PF-000000 first.",
      status: 409,
    });
  });

  it("reports when nothing is ready to pack", async () => {
    mocks.findOne.mockResolvedValueOnce(readyOrder).mockResolvedValueOnce(null);
    mocks.oldest.mockResolvedValue(null);
    await expect(claimAssignedOrder("PF-000001", "worker-1", "W")).rejects.toMatchObject({
      message: "No orders are ready for packing.",
    });
  });

  it("blocks claiming an order someone else is actively packing", async () => {
    mocks.findOne
      .mockResolvedValueOnce({
        ...readyOrder,
        progress: "packing",
        packer: { id: "boss", name: "Boss" },
        claimedAt: new Date(),
      })
      .mockResolvedValueOnce(null);
    await expect(claimAssignedOrder("PF-000001", "worker-1", "W")).rejects.toMatchObject({
      message: "Being packed by Boss.",
      status: 409,
    });
  });

  it("lets a supervisor pack any ready order, skipping assignment and FIFO checks", async () => {
    mocks.findOne.mockResolvedValueOnce({ ...readyOrder, assignedUserId: "worker-2" }).mockResolvedValueOnce(null);

    await claimAssignedOrder("PF-000001", "boss", "Boss", true);

    expect(mocks.find).not.toHaveBeenCalled();
    const [filter] = mocks.updateOne.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(filter).not.toHaveProperty("assignedUserId");
  });

  it("asks for a retry when the order changed underneath", async () => {
    mocks.findOne.mockResolvedValueOnce(readyOrder).mockResolvedValueOnce(null);
    mocks.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(claimAssignedOrder("PF-000001", "worker-1", "W")).rejects.toMatchObject({
      message: "Order changed. Please retry.",
    });
  });

  it("exposes ClaimError with an HTTP status", () => {
    const err = new ClaimError("nope", 418);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(418);
    expect(err.name).toBe("ClaimError");
  });
});
