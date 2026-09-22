export type OrderSource = "External" | "Manual" | "Imported";
export type OrderStatus = "Available" | "Draft" | "Imported";

export type OrderItem = {
  ItemCode: string;
  ItemReference: string;
  Width: number;
  Length: number;
  Depth: number;
  BoxGroup?: string;
};

export type SavedOrder = {
  orderId: string;
  source: OrderSource;
  status: OrderStatus;
  items: OrderItem[];
};

const validSources: OrderSource[] = ["External", "Manual", "Imported"];
const validStatuses: OrderStatus[] = ["Available", "Draft", "Imported"];

export function validateOrder(value: unknown): SavedOrder {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid order.");
  }

  const body = value as Record<string, unknown>;

  const orderId = String(body.orderId ?? "").trim();
  if (!orderId) {
    throw new Error("Order ID is required.");
  }

  const source = String(body.source ?? "") as OrderSource;
  if (!validSources.includes(source)) {
    throw new Error("Invalid order source.");
  }

  const status = String(body.status ?? "") as OrderStatus;
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid order status.");
  }

  if (!Array.isArray(body.items)) {
    throw new Error("Order items are required.");
  }

  const items = body.items.map((rawItem, index) => {
    if (typeof rawItem !== "object" || rawItem === null) {
      throw new Error(`Item ${index + 1} is invalid.`);
    }

    const item = rawItem as Record<string, unknown>;

    const ItemCode = String(item.ItemCode ?? "").trim();
    const ItemReference = String(item.ItemReference ?? "").trim();
    const Width = Number(item.Width);
    const Length = Number(item.Length);
    const Depth = Number(item.Depth);
    const BoxGroup =
      item.BoxGroup === undefined || item.BoxGroup === null
        ? ""
        : String(item.BoxGroup).trim();

    if (!ItemCode) {
      throw new Error(`Item ${index + 1} requires ItemCode.`);
    }
    if (!ItemReference) {
      throw new Error(`Item ${index + 1} requires ItemReference.`);
    }
    if (
      !Number.isFinite(Width) || Width <= 0 ||
      !Number.isFinite(Length) || Length <= 0 ||
      !Number.isFinite(Depth) || Depth <= 0
    ) {
      throw new Error(`Item ${index + 1} has invalid dimensions.`);
    }

    return {
      ItemCode,
      ItemReference,
      Width,
      Length,
      Depth,
      ...(BoxGroup ? { BoxGroup } : {}),
    };
  });

  return { orderId, source, status, items };
}