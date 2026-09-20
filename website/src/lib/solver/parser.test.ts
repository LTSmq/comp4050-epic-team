import { describe, it, expect } from "vitest";
import { parseOrderForSolver } from "./parser";
import type { Order } from "./types";

const sampleOrder: Order = {
  orderId: "order-1",
  boxes: [
    {
      boxId: "box-1",
      width: 100, length: 80, depth: 60,
      items: [
        { itemId: "item-1", width: 20, length: 15, depth: 10, quantity: 2 },
        { itemId: "item-2", width: 30, length: 20, depth: 15, quantity: 1 },
      ],
    },
  ],
};

describe("parseOrderForSolver", () => {
  it("maps camelCase fields to the solver's snake_case contract", () => {
    const r = parseOrderForSolver(sampleOrder);
    expect(r.order_id).toBe("order-1");
    expect(r.boxes[0].box_id).toBe("box-1");
    expect(r.boxes[0].items[0].item_id).toBe("item-1");
  });

  it("preserves dimensions and quantities", () => {
    const box = parseOrderForSolver(sampleOrder).boxes[0];
    expect(box).toMatchObject({ width: 100, length: 80, depth: 60 });
    expect(box.items[0]).toMatchObject({ width: 20, length: 15, depth: 10, quantity: 2 });
  });

  it("keeps every box and item", () => {
    const r = parseOrderForSolver(sampleOrder);
    expect(r.boxes).toHaveLength(1);
    expect(r.boxes[0].items).toHaveLength(2);
  });

  it("handles an order with no boxes", () => {
    expect(parseOrderForSolver({ orderId: "empty", boxes: [] }))
      .toEqual({ order_id: "empty", boxes: [] });
  });
});