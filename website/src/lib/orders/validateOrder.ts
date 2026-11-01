import {
  validateItems,
  validSources,
  validStatuses,
  type OrderItem,
  type OrderSource,
  type OrderStatus,
} from "@/lib/orders";

export type { OrderItem, OrderSource, OrderStatus };

// Incoming order data does NOT contain orderId.
// The backend will generate it.
export type ValidatedOrderInput = {
  source: OrderSource;
  status: OrderStatus;
  items: OrderItem[];
};

/** Validates a new order (no orderId yet). Item rules live in lib/orders.ts. */
export function validateOrder(value: unknown): ValidatedOrderInput {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid order.");
  }

  const body = value as Record<string, unknown>;

  const source = String(body.source ?? "") as OrderSource;
  if (!validSources.includes(source)) {
    throw new Error("Invalid order source.");
  }

  const status = String(body.status ?? "") as OrderStatus;
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid order status.");
  }

  return { source, status, items: validateItems(body.items) };
}
