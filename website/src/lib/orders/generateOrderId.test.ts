import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-ins for the "counters" and "orders" collections.
const db = vi.hoisted(() => ({
  counter: null as { _id: string; seq: number } | null,
  highestOrderId: null as string | null,
}));

vi.mock("@/lib/mongodb", () => {
  const counters = {
    findOne: vi.fn(async () => db.counter),
    updateOne: vi.fn(async (_filter: unknown, update: { $max: { seq: number } }) => {
      db.counter = { _id: "orderId", seq: Math.max(db.counter?.seq ?? 0, update.$max.seq) };
    }),
    findOneAndUpdate: vi.fn(async () => {
      db.counter = { _id: "orderId", seq: (db.counter?.seq ?? 0) + 1 };
      return db.counter;
    }),
  };
  const orders = {
    find: vi.fn(() => ({
      sort: () => ({ limit: () => ({ next: async () => (db.highestOrderId ? { orderId: db.highestOrderId } : null) }) }),
    })),
  };
  return {
    default: { db: () => ({ collection: (name: string) => (name === "counters" ? counters : orders) }) },
  };
});

import { generateOrderId } from "./generateOrderId";

describe("generateOrderId", () => {
  beforeEach(() => {
    db.counter = null;
    db.highestOrderId = null;
  });

  it("starts at PF-000001 on an empty database", async () => {
    await expect(generateOrderId()).resolves.toBe("PF-000001");
  });

  it("uses the PF-###### format", async () => {
    expect(await generateOrderId()).toMatch(/^PF-\d{6}$/);
  });

  it("gives a new, increasing ID every time", async () => {
    const ids = [await generateOrderId(), await generateOrderId(), await generateOrderId()];
    expect(ids).toEqual(["PF-000001", "PF-000002", "PF-000003"]);
  });

  it("continues after the highest existing order when the counter is missing", async () => {
    db.highestOrderId = "PF-000041";
    await expect(generateOrderId()).resolves.toBe("PF-000042");
  });

  it("continues from an existing counter", async () => {
    db.counter = { _id: "orderId", seq: 99 };
    await expect(generateOrderId()).resolves.toBe("PF-000100");
  });
});
