import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  toArray: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  claimAssignedOrder: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  default: {
    db: () => ({
      collection: () => ({
        find: mocks.find,
        findOne: mocks.findOne,
        findOneAndUpdate: mocks.findOneAndUpdate,
        updateOne: mocks.updateOne,
      }),
    }),
  },
}));

vi.mock("./claimAssigned", () => {
  class ClaimError extends Error {
    constructor(message: string, public status: number) {
      super(message);
      this.name = "ClaimError";
    }
  }
  return { ClaimError, claimAssignedOrder: mocks.claimAssignedOrder };
});

vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));

import type { AuthUser } from "@/lib/auth";
import type { Role } from "@/lib/rbac";
import { ClaimError } from "./claimAssigned";
import {
  PACK_ACTIONS,
  PackingError,
  getPackingOrder,
  isLocked,
  listPackingChanges,
  listPackingOrders,
  resetOrderSolution,
  runPackAction,
  sameItems,
} from "./packing";

const user = (role: Role, userId = "u1"): AuthUser => ({ userId, email: `${userId}@x.com`, username: `${userId}-name`, role });
const team = user("team", "pack1");
const boss = user("supervisor", "boss");

const doc = (over: Record<string, unknown> = {}) => ({
  orderId: "PF-000001",
  progress: "packing",
  items: [{ ItemCode: "A", ItemReference: "Mug", Width: 1, Length: 1, Depth: 1 }],
  ...over,
});

type Call = [Record<string, unknown>, { $set: Record<string, unknown> }];
const updateCall = () => mocks.findOneAndUpdate.mock.calls[0] as unknown as Call;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: mocks.toArray }) }) });
  mocks.toArray.mockResolvedValue([]);
  mocks.findOneAndUpdate.mockResolvedValue(doc());
});

describe("listPackingOrders", () => {
  it("returns open orders plus recently packed ones, oldest solved first", async () => {
    const now = new Date("2026-11-01T12:00:00Z");
    mocks.toArray.mockResolvedValue([
      { orderId: "PF-1", progress: "ready", itemCount: 3, solvedAt: new Date("2026-11-01T10:00:00Z") },
    ]);

    const rows = await listPackingOrders(now);

    const filter = mocks.find.mock.calls[0][0] as { $or: Array<Record<string, unknown>> };
    expect(filter).not.toHaveProperty("assignedUserId");
    expect(filter.$or[0]).toEqual({ progress: { $in: ["ready", "packing", "on_hold"] } });
    expect(filter.$or[1]).toEqual({ progress: "packed", packedAt: { $gte: new Date("2026-11-01T00:00:00Z") } });
    expect(rows).toEqual([
      expect.objectContaining({ orderId: "PF-1", progress: "ready", itemCount: 3, solvedAt: "2026-11-01T10:00:00.000Z" }),
    ]);
  });

  it("limits a packer to their own assigned orders", async () => {
    await listPackingOrders(new Date(), "pack1");
    expect(mocks.find.mock.calls[0][0]).toMatchObject({ assignedUserId: "pack1" });
  });

  it("fills defaults for missing fields", async () => {
    mocks.toArray.mockResolvedValue([{ orderId: "PF-2", progress: "weird", items: [1, 2] }]);
    const [row] = await listPackingOrders(new Date());
    expect(row).toMatchObject({
      progress: "submitted",
      itemCount: 2,
      customerName: "Unassigned",
      packer: null,
      claimedAt: null,
      holdItemCode: null,
    });
  });
});

describe("listPackingChanges", () => {
  it("returns rows changed since the cursor", async () => {
    const since = new Date("2026-11-01T11:00:00Z");
    mocks.toArray.mockResolvedValue([{ orderId: "PF-3", progress: "packing" }]);
    const rows = await listPackingChanges(since, "pack1");
    expect(mocks.find.mock.calls[0][0]).toEqual({ updatedAt: { $gt: since }, assignedUserId: "pack1" });
    expect(rows).toHaveLength(1);
  });

  it("returns null when there are too many changes, so the client does a full refresh", async () => {
    mocks.toArray.mockResolvedValue(Array.from({ length: 501 }, (_, i) => ({ orderId: `PF-${i}` })));
    await expect(listPackingChanges(new Date())).resolves.toBeNull();
  });
});

describe("getPackingOrder", () => {
  it("returns the order with items and hides customer details", async () => {
    mocks.findOne.mockResolvedValue(doc({ hold: { itemCode: "A" } }));
    const detail = await getPackingOrder("PF-000001", "pack1");
    expect(mocks.findOne.mock.calls[0][0]).toEqual({ orderId: "PF-000001", assignedUserId: "pack1" });
    expect(mocks.findOne.mock.calls[0][1]).toMatchObject({ projection: { customerId: 0, customerName: 0 } });
    expect(detail?.items).toHaveLength(1);
    expect(detail?.holdItemCode).toBe("A");
  });

  it("returns null when not found or not assigned to the packer", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(getPackingOrder("PF-000001", "someone")).resolves.toBeNull();
  });
});

describe("runPackAction: permissions", () => {
  it("lists every action", () => {
    expect(PACK_ACTIONS).toEqual(["claim", "release", "packed", "unavailable", "restore", "resolve", "reopen"]);
  });

  it("forbids customers from any packing action", async () => {
    await expect(runPackAction(user("customer"), "PF-000001", "release")).rejects.toMatchObject({ status: 403 });
  });

  for (const action of ["restore", "resolve", "reopen"] as const) {
    it(`only lets supervisors ${action}`, async () => {
      await expect(runPackAction(team, "PF-000001", action)).rejects.toMatchObject({ status: 403 });
      await expect(runPackAction(boss, "PF-000001", action)).resolves.toBeDefined();
    });
  }
});

describe("runPackAction: claim", () => {
  it("claims through the FIFO rules and returns the order", async () => {
    mocks.claimAssignedOrder.mockResolvedValue(undefined);
    mocks.findOne.mockResolvedValue(doc());
    const result = await runPackAction(team, "PF-000001", "claim");
    expect(mocks.claimAssignedOrder).toHaveBeenCalledWith("PF-000001", "pack1", "pack1-name", false);
    expect(result.orderId).toBe("PF-000001");
  });

  it("passes the supervisor flag through", async () => {
    mocks.claimAssignedOrder.mockResolvedValue(undefined);
    mocks.findOne.mockResolvedValue(doc());
    await runPackAction(boss, "PF-000001", "claim");
    expect(mocks.claimAssignedOrder).toHaveBeenCalledWith("PF-000001", "boss", "boss-name", true);
    expect(mocks.findOne.mock.calls[0][0]).toEqual({ orderId: "PF-000001" });
  });

  it("turns a claim error into a packing error with the same status", async () => {
    mocks.claimAssignedOrder.mockRejectedValue(new ClaimError("Pack order PF-000000 first.", 409));
    await expect(runPackAction(team, "PF-000001", "claim")).rejects.toMatchObject({
      message: "Pack order PF-000000 first.",
      status: 409,
    });
  });
});

describe("runPackAction: release and packed", () => {
  it("lets a packer release their own claim", async () => {
    await runPackAction(team, "PF-000001", "release");
    const [filter, update] = updateCall();
    expect(filter).toEqual({ orderId: "PF-000001", progress: "packing", "packer.id": "pack1" });
    expect(update.$set).toMatchObject({ progress: "ready", packer: null, claimedAt: null });
  });

  it("lets a supervisor release anyone's claim", async () => {
    await runPackAction(boss, "PF-000001", "release");
    expect(updateCall()[0]).toEqual({ orderId: "PF-000001", progress: "packing" });
  });

  it("records who packed the order and when", async () => {
    await runPackAction(team, "PF-000001", "packed");
    const [filter, update] = updateCall();
    expect(filter).toMatchObject({ progress: "packing", "packer.id": "pack1" });
    expect(update.$set).toMatchObject({
      progress: "packed",
      packedBy: { id: "pack1", name: "pack1-name" },
      packedAt: expect.any(Date),
      packer: null,
    });
  });
});

describe("runPackAction: item unavailable", () => {
  it("requires a valid item index", async () => {
    await expect(runPackAction(team, "PF-000001", "unavailable")).rejects.toMatchObject({ status: 400 });
    await expect(runPackAction(team, "PF-000001", "unavailable", -1)).rejects.toMatchObject({ status: 400 });
    await expect(runPackAction(team, "PF-000001", "unavailable", 1.5)).rejects.toMatchObject({ status: 400 });
  });

  it("puts the order on hold and flags the item", async () => {
    mocks.findOne.mockResolvedValue({ items: [{ ItemCode: "B" }] });
    await runPackAction(team, "PF-000001", "unavailable", 2);
    const [filter, update] = updateCall();
    expect(filter).toMatchObject({
      orderId: "PF-000001",
      "items.2.ItemCode": "B",
      progress: "packing",
      "packer.id": "pack1",
      assignedUserId: "pack1",
    });
    expect(update.$set).toMatchObject({
      "items.2.unavailable": true,
      progress: "on_hold",
      hold: { itemIndex: 2, itemCode: "B", by: { id: "pack1", name: "pack1-name" } },
    });
  });

  it("lets a supervisor flag items on ready or packing orders", async () => {
    mocks.findOne.mockResolvedValue({ items: [{ ItemCode: "B" }] });
    await runPackAction(boss, "PF-000001", "unavailable", 0);
    expect(updateCall()[0]).toMatchObject({ progress: { $in: ["ready", "packing"] } });
  });

  it("reports a missing order or item", async () => {
    mocks.findOne.mockResolvedValueOnce(null);
    await expect(runPackAction(team, "PF-000001", "unavailable", 0)).rejects.toMatchObject({ message: "Order not found.", status: 404 });
    mocks.findOne.mockResolvedValueOnce({ items: [] });
    await expect(runPackAction(team, "PF-000001", "unavailable", 9)).rejects.toMatchObject({ message: "Item not found.", status: 404 });
  });
});

describe("runPackAction: supervisor actions", () => {
  it("restore clears the hold and returns the order to ready", async () => {
    await runPackAction(boss, "PF-000001", "restore");
    const [filter, update] = updateCall();
    expect(filter).toEqual({ orderId: "PF-000001", progress: "on_hold" });
    expect(update.$set).toMatchObject({ progress: "ready", hold: null, "items.$[].unavailable": false });
  });

  it("resolve sends the order back to be solved again", async () => {
    await runPackAction(boss, "PF-000001", "resolve");
    expect(updateCall()[1].$set).toMatchObject({ progress: "submitted", hold: null, solvedAt: null });
  });

  it("reopen moves a packed order back to ready", async () => {
    await runPackAction(boss, "PF-000001", "reopen");
    const [filter, update] = updateCall();
    expect(filter).toEqual({ orderId: "PF-000001", progress: "packed" });
    expect(update.$set).toMatchObject({ progress: "ready", packedBy: null, packedAt: null });
  });
});

describe("runPackAction: explaining a rejected change", () => {
  beforeEach(() => mocks.findOneAndUpdate.mockResolvedValue(null));

  it("404 when the order does not exist", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(runPackAction(team, "PF-404", "release")).rejects.toMatchObject({ message: "Order not found.", status: 404 });
  });

  it("409 naming the packer when someone else holds it", async () => {
    mocks.findOne.mockResolvedValue({ progress: "packing", packer: { id: "x", name: "Sam" } });
    await expect(runPackAction(team, "PF-1", "packed")).rejects.toMatchObject({ message: "Being packed by Sam.", status: 409 });
  });

  it("409 describing the current state otherwise", async () => {
    mocks.findOne.mockResolvedValue({ progress: "packed" });
    await expect(runPackAction(team, "PF-1", "release")).rejects.toMatchObject({ message: "Order is packed.", status: 409 });
  });

  it("uses PackingError", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(runPackAction(team, "PF-1", "release")).rejects.toBeInstanceOf(PackingError);
  });
});

describe("sameItems", () => {
  const a = { ItemCode: "A", ItemReference: "Mug", Width: 1, Length: 2, Depth: 3 };

  it("is true for identical lists and ignores the unavailable flag", () => {
    expect(sameItems([a], [{ ...a, unavailable: true } as typeof a])).toBe(true);
  });

  it("treats a missing and an empty box group as the same", () => {
    expect(sameItems([a], [{ ...a, BoxGroup: "" }])).toBe(true);
  });

  it("detects changed codes, sizes, groups, order and length", () => {
    expect(sameItems([a], [{ ...a, ItemCode: "B" }])).toBe(false);
    expect(sameItems([a], [{ ...a, Depth: 4 }])).toBe(false);
    expect(sameItems([a], [{ ...a, BoxGroup: "G" }])).toBe(false);
    expect(sameItems([a, { ...a, ItemCode: "B" }], [{ ...a, ItemCode: "B" }, a])).toBe(false);
    expect(sameItems([a], [a, a])).toBe(false);
  });
});

describe("isLocked", () => {
  it("locks orders being packed or already packed", () => {
    expect(isLocked("packing")).toBe(true);
    expect(isLocked("packed")).toBe(true);
    for (const p of ["submitted", "solving", "ready", "on_hold", "failed", undefined] as const) {
      expect(isLocked(p)).toBe(false);
    }
  });
});

describe("resetOrderSolution", () => {
  it("returns the order to submitted and clears assignment and claim", async () => {
    await resetOrderSolution("PF-000001");
    const [filter, update] = mocks.updateOne.mock.calls[0] as unknown as Call;
    expect(filter).toEqual({ orderId: "PF-000001" });
    expect(update.$set).toMatchObject({
      progress: "submitted",
      solvedAt: null,
      hold: null,
      packer: null,
      claimedAt: null,
      assignedUserId: null,
      assignedUserName: null,
      assignedAt: null,
    });
  });
});
