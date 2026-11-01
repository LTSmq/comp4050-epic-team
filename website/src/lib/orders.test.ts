import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: { db: vi.fn() } }));

import { validateItems, validateOrder, validSources, validStatuses } from "./orders";

const item = {
  ItemCode: "ITEM-001",
  ItemReference: "Mug",
  Width: 120,
  Length: 95,
  Depth: 100,
  Weight: 350,
};

describe("validateItems", () => {
  it("accepts valid items and keeps a box group", () => {
    expect(validateItems([{ ...item, BoxGroup: "FRAGILE" }])).toEqual([
      { ...item, BoxGroup: "FRAGILE" },
    ]);
  });

  it("trims text and converts numeric strings", () => {
    expect(
      validateItems([
        { ItemCode: "  ITEM-002 ", ItemReference: " Lid ", Width: "10", Length: "20", Depth: "5", Weight: "40" },
      ])
    ).toEqual([{ ItemCode: "ITEM-002", ItemReference: "Lid", Width: 10, Length: 20, Depth: 5, Weight: 40 }]);
  });

  it("drops an empty or missing box group", () => {
    const [withBlank] = validateItems([{ ...item, BoxGroup: "   " }]);
    const [withNull] = validateItems([{ ...item, BoxGroup: null }]);
    expect(withBlank).not.toHaveProperty("BoxGroup");
    expect(withNull).not.toHaveProperty("BoxGroup");
  });

  it("requires an array", () => {
    expect(() => validateItems(undefined)).toThrow("Order items are required.");
    expect(() => validateItems({})).toThrow("Order items are required.");
  });

  it("rejects an item that is not an object", () => {
    expect(() => validateItems([item, null])).toThrow("Item 2 is invalid.");
  });

  it("requires ItemCode and ItemReference", () => {
    expect(() => validateItems([{ ...item, ItemCode: " " }])).toThrow("Item 1 requires ItemCode.");
    expect(() => validateItems([{ ...item, ItemReference: "" }])).toThrow("Item 1 requires ItemReference.");
  });

  for (const field of ["Width", "Length", "Depth", "Weight"] as const) {
    it(`rejects a zero, negative or non-numeric ${field}`, () => {
      for (const bad of [0, -5, "abc", undefined]) {
        expect(() => validateItems([{ ...item, [field]: bad }])).toThrow("Item 1 has invalid dimensions.");
      }
    });
  }
});

describe("validateOrder (saved order)", () => {
  const order = { orderId: "PF-000001", source: "Manual", status: "Draft", items: [item] };

  it("accepts a valid saved order", () => {
    expect(validateOrder(order)).toEqual(order);
  });

  it("requires an orderId", () => {
    expect(() => validateOrder({ ...order, orderId: "  " })).toThrow("Order ID is required.");
  });

  it("rejects a non-object", () => {
    expect(() => validateOrder("order")).toThrow("Invalid order.");
  });

  it("rejects an unknown source or status", () => {
    expect(() => validateOrder({ ...order, source: "Fax" })).toThrow("Invalid order source.");
    expect(() => validateOrder({ ...order, status: "Lost" })).toThrow("Invalid order status.");
  });

  it("lists the allowed sources and statuses", () => {
    expect(validSources).toEqual(["External", "Manual", "Imported"]);
    expect(validStatuses).toEqual(["Available", "Draft", "Imported"]);
  });
});
