import { describe, it, expect } from "vitest";
import { validateOrder, type OrderRequest } from "./validateOrder";

const validOrder: OrderRequest = {
  orderReference: "ORD-1",
  destination: "Sydney",
  sortingLocation: "Bay 3",
  items: [
    { reference: "ITEM-1", quantity: 2,
      dimensions: { width: 10, height: 10, depth: 10 }, weight: 1.5 },
  ],
};

describe("validateOrder", () => {
  it("accepts a well-formed order", () => {
    expect(validateOrder(validOrder)).toBeNull();
  });

  it("rejects an order with no items", () => {
    expect(validateOrder({ ...validOrder, items: [] }))
      .toBe("At least one item is required.");
  });

  it("rejects a missing order reference", () => {
    expect(validateOrder({ ...validOrder, orderReference: "" }))
      .toBe("Order reference is required.");
  });

  it("rejects an item with zero quantity", () => {
    expect(validateOrder({
      ...validOrder,
      items: [{ ...validOrder.items[0], quantity: 0 }],
    })).toBe("Each item requires a valid quantity.");
  });

  it("rejects zero-sized dimensions", () => {
    expect(validateOrder({
      ...validOrder,
      items: [{ ...validOrder.items[0],
        dimensions: { width: 0, height: 10, depth: 10 } }],
    })).toBe("Each item requires valid dimensions.");
  });
});