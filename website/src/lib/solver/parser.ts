import { Order } from "./types";

export function parseOrderForSolver(order: Order) {
  return {
    order_id: order.orderId,

    boxes: order.boxes.map((box) => ({
      box_id: box.boxId,

      width: box.width,
      length: box.length,
      depth: box.depth,

      items: box.items.map((item) => ({
        item_id: item.itemId,

        width: item.width,
        length: item.length,
        depth: item.depth,

        quantity: item.quantity,
      })),
    })),
  };
}