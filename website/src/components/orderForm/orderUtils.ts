/**
 * Order Workbench Pure Utility & Parsing Engine
 *
 * Responsibility:
 * Headless, side-effect-free helper functions for order data transformation, CSV/JSON file parsing
 * schema normalization, deduplication merging, and item array updating. Completely decoupled from React
 */

import { ApiRecord, OrderItem, OrderRecord, OrderSource } from "./types";

export const emptyItem = (): OrderItem => ({
  ItemCode: "",
  ItemReference: "",
  Width: 0,
  Length: 0,
  Depth: 0,
  BoxGroup: "",
});

export function getValue(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }

    const foundKey = Object.keys(record).find(
      (existingKey) => existingKey.toLowerCase() === key.toLowerCase(),
    );

    if (foundKey) {
      return record[foundKey];
    }
  }

  return undefined;
}

export function getOrderId(record: ApiRecord) {
  const value = getValue(record, [
    "orderId",
    "orderID",
    "OrderID",
    "id",
    "_id",
  ]);

  return value === undefined || value === null ? "" : String(value);
}

export function normaliseItem(value: unknown, index: number): OrderItem {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Item ${index + 1} is invalid.`);
  }

  const item = value as ApiRecord;

  const itemCode = String(
    getValue(item, ["ItemCode", "itemCode", "itemId", "id"]) ?? "",
  ).trim();

  const itemReference = String(
    getValue(item, [
      "ItemReference",
      "itemReference",
      "reference",
      "name",
      "itemId",
    ]) ?? itemCode,
  ).trim();

  const width = Number(getValue(item, ["Width", "width"]) ?? 0);
  const length = Number(getValue(item, ["Length", "length"]) ?? 0);
  const depth = Number(getValue(item, ["Depth", "depth"]) ?? 0);

  const boxGroupRaw = getValue(item, ["BoxGroup", "boxGroup"]);
  const boxGroup =
    boxGroupRaw === undefined || boxGroupRaw === null
      ? ""
      : String(boxGroupRaw).trim();

  if (!itemCode) {
    throw new Error(`Item ${index + 1} requires an item code.`);
  }

  if (!itemReference) {
    throw new Error(`Item ${index + 1} requires an item reference.`);
  }

  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(length) ||
    length <= 0 ||
    !Number.isFinite(depth) ||
    depth <= 0
  ) {
    throw new Error(`Item ${index + 1} requires valid dimensions.`);
  }

  return {
    ItemCode: itemCode,
    ItemReference: itemReference,
    Width: width,
    Length: length,
    Depth: depth,
    ...(boxGroup ? { BoxGroup: boxGroup } : {}),
  };
}

export function extractItems(record: ApiRecord) {
  const directItems = getValue(record, ["items"]);

  if (Array.isArray(directItems)) {
    return directItems.map((item, index) => normaliseItem(item, index));
  }

  const boxes = getValue(record, ["boxes"]);

  if (Array.isArray(boxes)) {
    const items: unknown[] = [];

    boxes.forEach((rawBox) => {
      if (typeof rawBox !== "object" || rawBox === null) {
        return;
      }

      const box = rawBox as ApiRecord;
      const boxItems = getValue(box, ["items"]);

      if (Array.isArray(boxItems)) {
        items.push(...boxItems);
      }
    });

    return items.map((item, index) => normaliseItem(item, index));
  }

  return [];
}

export function normaliseOrder(
  value: unknown,
  source: OrderSource,
): OrderRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as ApiRecord;
  const orderId = getOrderId(record);

  if (!orderId) {
    return null;
  }

  let items: OrderItem[] = [];

  try {
    items = extractItems(record);
  } catch {
    // Summary may not contain items.
  }

  return {
    orderId,
    source,
    status:
      source === "External"
        ? "Available"
        : source === "Imported"
          ? "Imported"
          : "Draft",
    items,
  };
}

export function extractExternalOrders(payload: unknown): OrderRecord[] {
  if (Array.isArray(payload)) {
    return payload
      .map((record) => normaliseOrder(record, "External"))
      .filter((order): order is OrderRecord => order !== null);
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const object = payload as ApiRecord;

  for (const key of ["orders", "data", "results"]) {
    const value = object[key];

    if (Array.isArray(value)) {
      return value
        .map((record) => normaliseOrder(record, "External"))
        .filter((order): order is OrderRecord => order !== null);
    }
  }

  const order = normaliseOrder(object, "External");

  return order ? [order] : [];
}

export function mergeOrders(current: OrderRecord[], incoming: OrderRecord[]) {
  const map = new Map<string, OrderRecord>();

  current.forEach((order) => {
    map.set(order.orderId, order);
  });

  incoming.forEach((order) => {
    map.set(order.orderId, order);
  });

  return Array.from(map.values());
}

export function parseCsvLine(line: string) {
  const values: string[] = [];

  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

export function parseCsvOrders(
  content: string,
  fallbackOrderId: string,
): OrderRecord[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("The CSV does not contain any order items.");
  }

  const headers = parseCsvLine(lines[0]);

  const records = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record: ApiRecord = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    return record;
  });

  const groups = new Map<string, ApiRecord[]>();

  records.forEach((record) => {
    const csvOrderId = getOrderId(record);
    const orderId = csvOrderId || fallbackOrderId.trim();

    if (!orderId) {
      throw new Error(
        "The CSV needs an OrderID column, or you must enter an Order ID before importing.",
      );
    }

    const existing = groups.get(orderId) ?? [];
    existing.push(record);
    groups.set(orderId, existing);
  });

  return Array.from(groups.entries()).map(([orderId, items]) => ({
    orderId,
    source: "Imported" as const,
    status: "Imported" as const,
    items: items.map((item, index) => normaliseItem(item, index)),
  }));
}

export function parseJsonOrders(
  content: string,
  fallbackOrderId: string,
): OrderRecord[] {
  const parsed = JSON.parse(content);

  if (Array.isArray(parsed)) {
    const looksLikeOrders = parsed.some(
      (record) =>
        typeof record === "object" &&
        record !== null &&
        getOrderId(record as ApiRecord),
    );

    if (looksLikeOrders) {
      return parsed
        .map((record) => normaliseOrder(record, "Imported"))
        .filter((order): order is OrderRecord => order !== null)
        .map((order) => ({
          ...order,
          status: "Imported",
        }));
    }

    const orderId = fallbackOrderId.trim();

    if (!orderId) {
      throw new Error(
        "Enter an Order ID before importing an item-array JSON file.",
      );
    }

    return [
      {
        orderId,
        source: "Imported",
        status: "Imported",
        items: parsed.map((item, index) => normaliseItem(item, index)),
      },
    ];
  }

  const order = normaliseOrder(parsed, "Imported");

  if (!order) {
    throw new Error("The JSON does not contain a valid order.");
  }

  return [
    {
      ...order,
      status: "Imported",
    },
  ];
}

export function updateItemInList(
  items: OrderItem[],
  index: number,
  field: keyof OrderItem,
  value: string,
): OrderItem[] {
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }

    if (field === "Width" || field === "Length" || field === "Depth") {
      return {
        ...item,
        [field]: value === "" ? 0 : Number(value),
      };
    }

    return {
      ...item,
      [field]: value,
    };
  });
}
