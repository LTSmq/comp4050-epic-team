import { getSolution } from "@/app/lib/solutionStore";
import type { SavedOrder } from "@/lib/orders";
import { buildSolverRequest } from "@/lib/solver/request";
import {
  parseSolverSolution,
  SolverSolutionParseError,
  validateSolverSolution,
} from "@/lib/solver/solution";

/** Reuse only a complete layout covering the order's current available units. */
export async function hasCompleteStoredSolution(order: SavedOrder): Promise<boolean> {
  if (order.items.length === 0) return false;
  const stored = await getSolution(order.orderId);
  if (!stored) return false;

  try {
    const parsed = parseSolverSolution(stored.raw);
    validateSolverSolution(parsed, buildSolverRequest(order));
    return parsed.unpacked.length === 0;
  } catch (error) {
    if (error instanceof SolverSolutionParseError) return false;
    throw error;
  }
}
