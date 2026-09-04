import { describe, it, expect } from "vitest";
import { parseOrderForSolver } from "./parser";
import { mockOrders, mockBoxTypes } from "./mockOrder";
import type { Order } from "./types";

describe("parseOrderForSolver", () => {
  it("maps every camelCase item field to its PascalCase solver field", () => {
    const order: Order = {
      orderId: "test",
      items: [
        { itemCode: "ITM-9", itemReference: "Widget", width: 10, length: 20, depth: 30, weight: 4.5, boxGroup: "A", quantity: 1 },
      ],
    };

    const request = parseOrderForSolver(order, mockBoxTypes);

    expect(request.Items[0]).toEqual({
      ItemCode: "ITM-9",
      ItemReference: "Widget",
      Width: 10,
      Length: 20,
      Depth: 30,
      Weight: 4.5,
      BoxGroup: "A",
    });
  });

  it("passes the box types through unchanged", () => {
    const request = parseOrderForSolver(mockOrders[0], mockBoxTypes);
    expect(request.BoxTypes).toEqual(mockBoxTypes);
  });

  it("expands an item with quantity > 1 into that many solver items", () => {
    const order: Order = {
      orderId: "test",
      items: [
        { itemCode: "ITM-1", itemReference: "Box", width: 1, length: 1, depth: 1, weight: 1, boxGroup: null, quantity: 3 },
      ],
    };

    expect(parseOrderForSolver(order, mockBoxTypes).Items).toHaveLength(3);
  });

  it("suffixes the ItemCode with a 1-based index when quantity > 1", () => {
    const order: Order = {
      orderId: "test",
      items: [
        { itemCode: "ITM-1", itemReference: "Box", width: 1, length: 1, depth: 1, weight: 1, boxGroup: null, quantity: 2 },
      ],
    };

    expect(parseOrderForSolver(order, mockBoxTypes).Items.map((i) => i.ItemCode))
      .toEqual(["ITM-1-1", "ITM-1-2"]);
  });

  it("does not suffix the ItemCode when quantity is exactly 1", () => {
    const order: Order = {
      orderId: "test",
      items: [
        { itemCode: "ITM-1", itemReference: "Box", width: 1, length: 1, depth: 1, weight: 1, boxGroup: null, quantity: 1 },
      ],
    };

    expect(parseOrderForSolver(order, mockBoxTypes).Items[0].ItemCode).toBe("ITM-1");
  });

  it("keeps the same ItemReference across duplicated items", () => {
    const order: Order = {
      orderId: "test",
      items: [
        { itemCode: "ITM-1", itemReference: "Crate A", width: 1, length: 1, depth: 1, weight: 1, boxGroup: null, quantity: 2 },
      ],
    };

    expect(parseOrderForSolver(order, mockBoxTypes).Items.map((i) => i.ItemReference))
      .toEqual(["Crate A", "Crate A"]);
  });

  it("defaults quantity to 1 when it is omitted", () => {
    const order: Order = {
      orderId: "test",
      items: [
        { itemCode: "ITM-1", itemReference: "Box", width: 1, length: 1, depth: 1, weight: 1 },
      ],
    };

    const request = parseOrderForSolver(order, mockBoxTypes);
    expect(request.Items).toHaveLength(1);
    expect(request.Items[0].ItemCode).toBe("ITM-1");
  });

  it("defaults BoxGroup to null when it is omitted", () => {
    const order: Order = {
      orderId: "test",
      items: [
        { itemCode: "ITM-1", itemReference: "Box", width: 1, length: 1, depth: 1, weight: 1 },
      ],
    };

    expect(parseOrderForSolver(order, mockBoxTypes).Items[0].BoxGroup).toBeNull();
  });

  it("preserves a provided BoxGroup", () => {
    const order: Order = {
      orderId: "test",
      items: [
        { itemCode: "ITM-1", itemReference: "Box", width: 1, length: 1, depth: 1, weight: 1, boxGroup: "GROUP-X", quantity: 1 },
      ],
    };

    expect(parseOrderForSolver(order, mockBoxTypes).Items[0].BoxGroup).toBe("GROUP-X");
  });

  it("flattens multiple items in order, expanding by quantity", () => {
    // mockOrders[0]: ITM-001 x2, ITM-002 x1  ->  3 items
    expect(parseOrderForSolver(mockOrders[0], mockBoxTypes).Items.map((i) => i.ItemCode))
      .toEqual(["ITM-001-1", "ITM-001-2", "ITM-002"]);
  });

  it("produces no solver items for an empty order", () => {
    expect(parseOrderForSolver({ orderId: "test", items: [] }, mockBoxTypes).Items).toEqual([]);
  });

  it("emits no items when quantity is 0 (documents current behaviour)", () => {
    const order: Order = {
      orderId: "test",
      items: [
        { itemCode: "ITM-1", itemReference: "Box", width: 1, length: 1, depth: 1, weight: 1, boxGroup: null, quantity: 0 },
      ],
    };

    expect(parseOrderForSolver(order, mockBoxTypes).Items).toEqual([]);
  });
});