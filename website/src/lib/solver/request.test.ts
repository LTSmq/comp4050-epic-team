import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: { db: vi.fn() } }));

import { BOX_TYPES } from "./boxTypes";
import { buildSolverRequest } from "./request";

describe("buildSolverRequest", () => {
  it("sends every item (weight in kg) with the full carton catalogue", () => {
    const request = buildSolverRequest({
      orderId: "PF-000007",
      source: "External",
      status: "Available",
      items: [{ ItemCode: "A", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 350 }],
    });
    expect(request).toEqual({
      OrderId: "PF-000007",
      Items: [{ ItemCode: "A", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 0.35, BoxGroup: null }],
      BoxTypes: BOX_TYPES,
    });
  });
});

describe("BOX_TYPES", () => {
  it("offers the small and medium cartons", () => {
    expect(BOX_TYPES.map((b) => b.Reference)).toEqual(["SML", "MED"]);
  });

  it("has positive sizes and weight limits, and every carton is active", () => {
    for (const box of BOX_TYPES) {
      expect(box.Width).toBeGreaterThan(0);
      expect(box.Length).toBeGreaterThan(0);
      expect(box.Depth).toBeGreaterThan(0);
      expect(box.MaxWeight ?? 0).toBeGreaterThan(0);
      expect(box.Active).toBe(true);
    }
  });

  it("has unique references", () => {
    expect(new Set(BOX_TYPES.map((b) => b.Reference)).size).toBe(BOX_TYPES.length);
  });
});
