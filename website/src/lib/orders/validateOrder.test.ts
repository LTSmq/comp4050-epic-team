
import { describe, expect, it } from "vitest";
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
      BoxGroup: "A",
    },
  ],
};

describe("validateOrder", () => {
  it("accepts a valid order", () => {
    const result = validateOrder(validOrder);

    expect(result).toEqual(validOrder);
  });

  it("does not require an orderId in incoming data", () => {
    const result = validateOrder(validOrder);

    expect(result).not.toHaveProperty("orderId");
  });

  it("rejects a null order", () => {
    expect(() => validateOrder(null)).toThrow("Invalid order.");
  });

  it("rejects an invalid source", () => {
    expect(() =>
      validateOrder({ ...validOrder, source: "Unknown" })
    ).toThrow("Invalid order source.");
  });

  it("rejects an invalid status", () => {
    expect(() =>
      validateOrder({ ...validOrder, status: "Unknown" })
    ).toThrow("Invalid order status.");
  });

  it("rejects missing items", () => {
    expect(() =>
      validateOrder({
        source: "Manual",
        status: "Draft",
      })
    ).toThrow("Order items are required.");
  });

  it("rejects an item with a missing ItemCode", () => {
    const order = {
      ...validOrder,
      items: [{ ...validOrder.items[0], ItemCode: "" }],
    };

    expect(() => validateOrder(order)).toThrow(
      "Item 1 requires ItemCode."
    );
  });

  it("rejects invalid dimensions", () => {
    const order = {
      ...validOrder,
      items: [{ ...validOrder.items[0], Width: 0 }],
    };

    expect(() => validateOrder(order)).toThrow(
      "Item 1 has invalid dimensions."
    );
  });
});
