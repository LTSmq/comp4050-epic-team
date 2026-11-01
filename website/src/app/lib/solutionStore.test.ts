import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateOne: vi.fn(), findOne: vi.fn(), deleteOne: vi.fn() }));

vi.mock("@/lib/mongodb", () => ({
  default: {
    db: () => ({
      collection: () => ({ updateOne: mocks.updateOne, findOne: mocks.findOne, deleteOne: mocks.deleteOne }),
    }),
  },
}));

import type { VisualiserCarton } from "@/components/visualiser-v2/types";
import { deleteSolution, getSolution, listSolutions, saveSolution } from "./solutionStore";

const carton = (items: number): VisualiserCarton => ({
  boxIndex: 0,
  boxReference: "SML",
  containerSize: { x: 0.15, y: 0.15, z: 0.15 },
  items: Array.from({ length: items }, (_, i) => ({ uuid: `0-A-${i}`, position: { x: 0, y: 0, z: 0 }, size: { x: 0.1, y: 0.1, z: 0.1 } })),
});
const raw = { id: "PF-1", packages: [], unpacked: [] };

describe("solutionStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MONGODB_URI", "mongodb://test");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.updateOne.mockResolvedValue({});
    mocks.deleteOne.mockResolvedValue({});
    mocks.findOne.mockResolvedValue(null);
  });

  it("saves a solution and persists it before returning", async () => {
    const saved = await saveSolution("PF-1", [carton(2)], raw);
    expect(saved).toMatchObject({ orderId: "PF-1", cartons: [carton(2)], raw, receivedAt: expect.any(String) });
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { orderId: "PF-1" },
      { $set: expect.objectContaining({ orderId: "PF-1", updatedAt: expect.any(Date) }) },
      { upsert: true }
    );
  });

  it("serves a saved solution from memory without hitting the database", async () => {
    await saveSolution("PF-2", [carton(1)], raw);
    await expect(getSolution("PF-2")).resolves.toMatchObject({ orderId: "PF-2" });
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("falls back to MongoDB after a restart", async () => {
    mocks.findOne.mockResolvedValue({ orderId: "PF-3", cartons: [carton(1)], raw, receivedAt: "2026-11-01T00:00:00.000Z", _id: "x" });
    await expect(getSolution("PF-3")).resolves.toEqual({
      orderId: "PF-3",
      cartons: [carton(1)],
      raw,
      receivedAt: "2026-11-01T00:00:00.000Z",
    });
  });

  it("returns undefined when there is no solution or no database", async () => {
    await expect(getSolution("PF-missing")).resolves.toBeUndefined();
    vi.stubEnv("MONGODB_URI", "");
    await expect(getSolution("PF-missing-2")).resolves.toBeUndefined();
  });

  it("still saves in memory if persisting fails", async () => {
    mocks.updateOne.mockRejectedValue(new Error("down"));
    await saveSolution("PF-4", [carton(1)], raw);
    await expect(getSolution("PF-4")).resolves.toMatchObject({ orderId: "PF-4" });
  });

  it("deletes from memory and MongoDB", async () => {
    await saveSolution("PF-5", [carton(1)], raw);
    await deleteSolution("PF-5");
    expect(mocks.deleteOne).toHaveBeenCalledWith({ orderId: "PF-5" });
    await expect(getSolution("PF-5")).resolves.toBeUndefined();
  });

  it("summarises stored solutions, newest first", async () => {
    await saveSolution("PF-6", [carton(2), carton(3)], raw);
    const list = listSolutions();
    expect(list[0]).toMatchObject({ orderId: "PF-6", cartonCount: 2, itemCount: 5 });
  });
});
