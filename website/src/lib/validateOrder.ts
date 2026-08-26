export type OrderItem = {
  reference: string;
  quantity: number;
  dimensions: { width: number; height: number; depth: number };
  weight: number;
};

export type OrderRequest = {
  orderReference: string;
  destination: string;
  sortingLocation: string;
  items: OrderItem[];
};

export function validateOrder(body: OrderRequest): string | null {
  if (!body.orderReference || typeof body.orderReference !== "string")
    return "Order reference is required.";
  if (!body.destination || typeof body.destination !== "string")
    return "Destination is required.";
  if (!body.sortingLocation || typeof body.sortingLocation !== "string")
    return "Sorting location is required.";
  if (!Array.isArray(body.items) || body.items.length === 0)
    return "At least one item is required.";

  for (const item of body.items) {
    if (!item.reference || typeof item.reference !== "string")
      return "Each item requires a reference.";
    if (!Number.isInteger(item.quantity) || item.quantity <= 0)
      return "Each item requires a valid quantity.";
    if (!item.dimensions || item.dimensions.width <= 0 ||
        item.dimensions.height <= 0 || item.dimensions.depth <= 0)
      return "Each item requires valid dimensions.";
    if (typeof item.weight !== "number" || item.weight <= 0)
      return "Each item requires a valid weight.";
  }
  return null;
}