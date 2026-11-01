import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: { db: vi.fn() } }));

import { validateOrder } from "./validateOrder";

const validOrder = {
  source: "Manual",
  status: "Draft",
  items: [
    {
      ItemCode: "ITEM-001",
      ItemReference: "REF-001",
      Width: 300,
      Length: 400,
      Depth: 200,
      Weight: 1500,
      BoxGroup: "A",
    },
  ],
};

describe("validateOrder (new order)", () => {
  it("accepts a valid order", () => {
    expect(validateOrder(validOrder)).toEqual(validOrder);
  });

  it("does not require or return an orderId (the server assigns it)", () => {
    expect(validateOrder(validOrder)).not.toHaveProperty("orderId");
    expect(validateOrder({ ...validOrder, orderId: "PF-999999" })).not.toHaveProperty("orderId");
  });

  it("rejects a null order", () => {
    expect(() => validateOrder(null)).toThrow("Invalid order.");
  });

  it("rejects an invalid source", () => {
    expect(() => validateOrder({ ...validOrder, source: "Unknown" })).toThrow("Invalid order source.");
  });

  it("rejects an invalid status", () => {
    expect(() => validateOrder({ ...validOrder, status: "Unknown" })).toThrow("Invalid order status.");
  });

  it("rejects missing items", () => {
    expect(() => validateOrder({ source: "Manual", status: "Draft" })).toThrow("Order items are required.");
  });

  it("rejects an item with a missing ItemCode", () => {
    const order = { ...validOrder, items: [{ ...validOrder.items[0], ItemCode: "" }] };
    expect(() => validateOrder(order)).toThrow("Item 1 requires ItemCode.");
  });

  it("rejects invalid dimensions", () => {
    const order = { ...validOrder, items: [{ ...validOrder.items[0], Width: 0 }] };
    expect(() => validateOrder(order)).toThrow("Item 1 has invalid dimensions.");
  });

  it("rejects a missing weight", () => {
    const { Weight: _omit, ...noWeight } = validOrder.items[0];
    void _omit;
    expect(() => validateOrder({ ...validOrder, items: [noWeight] })).toThrow("Item 1 has invalid dimensions.");
  });
});
