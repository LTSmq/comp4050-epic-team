import type { SavedOrder } from "@/lib/orders";
import type { Order } from "./types";

export function savedOrderToSolverOrder(
  order: SavedOrder
): Order {
  return {
    orderId: order.orderId,

    items: order.items.map((item) => ({
      itemCode: item.ItemCode,
      itemReference: item.ItemReference,
      width: item.Width,
      length: item.Length,
      depth: item.Depth,
      weight: 0,
      boxGroup: item.BoxGroup ?? null,
      quantity: 1,
    })),
  };
}