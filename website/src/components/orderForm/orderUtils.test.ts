import { describe, expect, it } from "vitest";
import {
  emptyItem,
  extractItems,
  getOrderId,
  getValue,
  mergeOrders,
  normaliseItem,
  normaliseOrder,
  parseCsvLine,
  parseCsvOrders,
  parseJsonOrders,
  updateItemInList,
} from "./orderUtils";
import type { OrderRecord } from "./types";

const mug = { ItemCode: "MUG", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 350 };

describe("getValue / getOrderId", () => {
  it("finds keys case-insensitively, in priority order", () => {
    expect(getValue({ WIDTH: 5 }, ["width"])).toBe(5);
    expect(getValue({ a: 1, b: 2 }, ["b", "a"])).toBe(2);
    expect(getValue({}, ["missing"])).toBeUndefined();
  });

  it("reads the order id from any common key", () => {
    expect(getOrderId({ OrderID: "T01" })).toBe("T01");
    expect(getOrderId({ orderId: 42 })).toBe("42");
    expect(getOrderId({ id: "X" })).toBe("X");
    expect(getOrderId({ orderId: null })).toBe("");
    expect(getOrderId({})).toBe("");
  });
});

describe("normaliseItem", () => {
  it("accepts PascalCase or camelCase fields", () => {
    expect(normaliseItem({ itemCode: "A", reference: "Lid", width: "10", length: 20, depth: 5, weight: 40, boxGroup: "G" }, 0)).toEqual({
      ItemCode: "A",
      ItemReference: "Lid",
      Width: 10,
      Length: 20,
      Depth: 5,
      Weight: 40,
      BoxGroup: "G",
    });
  });

  it("uses the item code as the reference when none is given", () => {
    expect(normaliseItem({ ...mug, ItemReference: undefined }, 0).ItemReference).toBe("MUG");
  });

  it("omits an empty box group", () => {
    expect(normaliseItem({ ...mug, BoxGroup: "  " }, 0)).not.toHaveProperty("BoxGroup");
  });

  it("explains what is wrong, numbering items from 1", () => {
    expect(() => normaliseItem(null, 0)).toThrow("Item 1 is invalid.");
    expect(() => normaliseItem({ ...mug, ItemCode: "" }, 2)).toThrow("Item 3 requires an item code.");
    expect(() => normaliseItem({ ...mug, Depth: 0 }, 0)).toThrow("Item 1 requires valid dimensions.");
    expect(() => normaliseItem({ ...mug, Weight: -1 }, 0)).toThrow("Item 1 requires a valid weight in grams.");
  });
});

describe("extractItems / normaliseOrder", () => {
  it("reads items directly or from boxes", () => {
    expect(extractItems({ items: [mug] })).toHaveLength(1);
    expect(extractItems({ boxes: [{ items: [mug] }, null, { items: [mug] }] })).toHaveLength(2);
    expect(extractItems({})).toEqual([]);
  });

  it("sets status from the source", () => {
    expect(normaliseOrder({ orderId: "1", items: [] }, "External")?.status).toBe("Available");
    expect(normaliseOrder({ orderId: "1", items: [] }, "Imported")?.status).toBe("Imported");
    expect(normaliseOrder({ orderId: "1", items: [] }, "Manual")?.status).toBe("Draft");
  });

  it("returns null without an order id", () => {
    expect(normaliseOrder({ items: [mug] }, "Imported")).toBeNull();
    expect(normaliseOrder("x", "Imported")).toBeNull();
  });
});

describe("mergeOrders", () => {
  it("adds new orders and replaces ones with the same id", () => {
    const a: OrderRecord = { orderId: "A", source: "Manual", status: "Draft", items: [] };
    const b: OrderRecord = { orderId: "B", source: "Manual", status: "Draft", items: [] };
    const a2: OrderRecord = { ...a, status: "Imported" };
    expect(mergeOrders([a, b], [a2])).toEqual([a2, b]);
  });
});

describe("parseCsvLine", () => {
  it("splits on commas and trims", () => {
    expect(parseCsvLine(" a , b,c ")).toEqual(["a", "b", "c"]);
  });

  it("keeps commas and escaped quotes inside quotes", () => {
    expect(parseCsvLine('T01,"Mug, large","He said ""hi"""')).toEqual(["T01", "Mug, large", 'He said "hi"']);
  });

  it("keeps empty cells", () => {
    expect(parseCsvLine("a,,c,")).toEqual(["a", "", "c", ""]);
  });
});

describe("parseCsvOrders", () => {
  const csv = [
    "OrderID,ItemCode,ItemReference,Width,Length,Depth,Weight,BoxGroup",
    "T01,SKU-1,Small cube,100,100,100,500,",
    "T02,SKU-2,Cleaner,100,100,200,800,CHEMICALS",
    "T02,SKU-3,Snack,120,80,60,200,FOOD",
    "",
  ].join("\r\n");

  it("groups rows into orders by OrderID", () => {
    const orders = parseCsvOrders(csv, "");
    expect(orders.map((o) => [o.orderId, o.items.length])).toEqual([
      ["T01", 1],
      ["T02", 2],
    ]);
    expect(orders[1].items[0]).toEqual({ ItemCode: "SKU-2", ItemReference: "Cleaner", Width: 100, Length: 100, Depth: 200, Weight: 800, BoxGroup: "CHEMICALS" });
    expect(orders.every((o) => o.source === "Imported" && o.status === "Imported")).toBe(true);
  });

  it("uses the fallback order id when the CSV has no OrderID column", () => {
    const orders = parseCsvOrders("ItemCode,ItemReference,Width,Length,Depth,Weight\nA,Mug,1,1,1,1", " MY-ORDER ");
    expect(orders).toEqual([expect.objectContaining({ orderId: "MY-ORDER" })]);
  });

  it("requires an order id from somewhere", () => {
    expect(() => parseCsvOrders("ItemCode,ItemReference,Width,Length,Depth,Weight\nA,Mug,1,1,1,1", "")).toThrow("The CSV needs an OrderID column");
  });

  it("rejects a CSV with no item rows", () => {
    expect(() => parseCsvOrders("OrderID,ItemCode\n", "")).toThrow("The CSV does not contain any order items.");
  });

  it("reports a bad row", () => {
    expect(() => parseCsvOrders("OrderID,ItemCode,ItemReference,Width,Length,Depth,Weight\nT1,A,Mug,1,1,1,0", "")).toThrow(
      "Item 1 requires a valid weight in grams."
    );
  });
});

describe("parseJsonOrders", () => {
  it("reads a list of orders", () => {
    const orders = parseJsonOrders(JSON.stringify([{ orderId: "J1", items: [mug] }, { orderId: "J2", items: [] }]), "");
    expect(orders.map((o) => [o.orderId, o.status, o.items.length])).toEqual([
      ["J1", "Imported", 1],
      ["J2", "Imported", 0],
    ]);
  });

  it("reads a single order object", () => {
    expect(parseJsonOrders(JSON.stringify({ id: "J3", items: [mug] }), "")[0]).toMatchObject({ orderId: "J3", status: "Imported" });
  });

  it("reads a bare item list using the fallback id", () => {
    expect(parseJsonOrders(JSON.stringify([mug, mug]), "FALLBACK")[0]).toMatchObject({ orderId: "FALLBACK", items: [mug, mug] });
  });

  it("requires a fallback id for a bare item list", () => {
    expect(() => parseJsonOrders(JSON.stringify([mug]), "  ")).toThrow("Enter an Order ID before importing an item-array JSON file.");
  });

  it("rejects JSON that is not an order", () => {
    expect(() => parseJsonOrders(JSON.stringify({ hello: "world" }), "")).toThrow("The JSON does not contain a valid order.");
    expect(() => parseJsonOrders("{not json", "")).toThrow();
  });
});

describe("updateItemInList / emptyItem", () => {
  it("updates only the chosen item, converting numeric fields", () => {
    const items = [emptyItem(), emptyItem()];
    const next = updateItemInList(items, 1, "Width", "250");
    expect(next[1].Width).toBe(250);
    expect(next[0]).toBe(items[0]);
    expect(updateItemInList(items, 0, "Weight", "")[0].Weight).toBe(0);
    expect(updateItemInList(items, 0, "ItemCode", "NEW")[0].ItemCode).toBe("NEW");
  });

  it("starts a new item blank", () => {
    expect(emptyItem()).toEqual({ ItemCode: "", ItemReference: "", Width: 0, Length: 0, Depth: 0, BoxGroup: "", Weight: 0 });
  });
});
