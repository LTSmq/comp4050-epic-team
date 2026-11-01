import type { SavedOrder } from "@/lib/orders";
import { mockBoxTypes } from "./mockOrder";
import { savedOrderToSolverOrder } from "./orderAdapter";
import { parseOrderForSolver } from "./parser";
import type { PackingRequest } from "./types";

/**
 * The exact /solve body the portal sends for a saved order.
 *
 * Kept in one place because the solver's reply carries geometry only, and
 * toVisualiserCartons needs this same request to restore carton references,
 * item weights and box groups.
 */
export function buildSolverRequest(order: SavedOrder): PackingRequest {
  return parseOrderForSolver(savedOrderToSolverOrder(order), mockBoxTypes);
}
