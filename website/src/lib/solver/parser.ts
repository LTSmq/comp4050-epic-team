import type {
  Order,
  PackingRequest,
  SolverBoxType,
  SolverItem,
} from "./types";

export function parseOrderForSolver(
  order: Order,
  boxTypes: SolverBoxType[]
): PackingRequest {
  const items: SolverItem[] = order.items.flatMap((item) => {
    const quantity = item.quantity ?? 1;

    return Array.from({ length: quantity }, (_, index) => ({
      ItemCode:
        quantity > 1
          ? `${item.itemCode}-${index + 1}`
          : item.itemCode,

      ItemReference: item.itemReference,
      Width: item.width,
      Length: item.length,
      Depth: item.depth,
      Weight: item.weight,
      BoxGroup: item.boxGroup ?? null,
    }));
  });

  return {
    Items: items,
    BoxTypes: boxTypes,
  };
}
