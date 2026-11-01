import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: { db: vi.fn() } }));

import { savedOrderToSolverOrder } from "./orderAdapter";

describe("savedOrderToSolverOrder", () => {
  it("maps a saved order to the solver order shape, converting grams to kg", () => {
    expect(
      savedOrderToSolverOrder({
        orderId: "PF-000001",
        source: "Manual",
        status: "Available",
        items: [
          { ItemCode: "A", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 350, BoxGroup: "K" },
          { ItemCode: "B", ItemReference: "Lid", Width: 60, Length: 60, Depth: 10, Weight: 2000 },
        ],
      })
    ).toEqual({
      orderId: "PF-000001",
      items: [
        { itemCode: "A", itemReference: "Mug", width: 120, length: 95, depth: 100, weight: 0.35, boxGroup: "K", quantity: 1 },
        { itemCode: "B", itemReference: "Lid", width: 60, length: 60, depth: 10, weight: 2, boxGroup: null, quantity: 1 },
      ],
    });
  });
});
