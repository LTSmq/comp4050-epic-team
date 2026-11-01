import { describe, expect, it } from "vitest";
import { parseOrderForSolver } from "./parser";
import type { Order, SolverBoxType } from "./types";

const box: SolverBoxType = {
  Reference: "SML",
  Width: 150,
  Length: 150,
  Depth: 150,
  MaxWeight: 8.5,
  BoxWeight: 0.5,
  Active: true,
  MaximumBoxes: 100,
};

const order: Order = {
  orderId: "PF-000001",
  items: [{ itemCode: "MUG", itemReference: "Mug", width: 120, length: 95, depth: 100, weight: 0.35, boxGroup: "KITCHEN" }],
};

describe("parseOrderForSolver", () => {
  it("builds the PascalCase request the solver expects", () => {
    expect(parseOrderForSolver(order, [box])).toEqual({
      OrderId: "PF-000001",
      Items: [
        { ItemCode: "MUG", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 0.35, BoxGroup: "KITCHEN" },
      ],
      BoxTypes: [box],
    });
  });

  it("expands a quantity into numbered units", () => {
    const request = parseOrderForSolver({ ...order, items: [{ ...order.items[0], quantity: 3 }] }, [box]);
    expect(request.Items.map((i) => i.ItemCode)).toEqual(["MUG-1", "MUG-2", "MUG-3"]);
  });

  it("sends a missing box group as null", () => {
    const request = parseOrderForSolver({ ...order, items: [{ ...order.items[0], boxGroup: undefined }] }, [box]);
    expect(request.Items[0].BoxGroup).toBeNull();
  });

  it("handles an order with no items", () => {
    expect(parseOrderForSolver({ ...order, items: [] }, [box]).Items).toEqual([]);
  });
});
