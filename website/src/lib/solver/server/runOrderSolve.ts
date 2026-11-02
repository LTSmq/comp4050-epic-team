import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { ObjectId } from "mongodb";
import { getOrdersCollection, validateOrder, type SavedOrder } from "@/lib/orders";
import { autoAssignOrder } from "@/lib/orders/autoAssign";
import { buildSolverRequest } from "@/lib/solver/request";
import {
  describeUnpacked,
  parseSolverSolution,
  validateSolverSolution,
  SolverSolutionParseError,
  toVisualiserCartons,
  type SolverSolution,
} from "@/lib/solver/solution";
import { acceptSolution, getSolution, StaleSolveError } from "@/app/lib/solutionStore";
import { postSolverRequest } from "./client";

type SolveScope = Record<string, unknown>;
type Attempt = { orderId: string; orderDocumentId: ObjectId; generation: string };

export type SolveOrderResult =
  | { ok: true; result: SolverSolution }
  | { ok: false; status: number; error: string; solverResult?: unknown };

/** Only the currently active generation may fail the order. */
export async function failSolve(attempt: Attempt): Promise<boolean> {
  const result = await getOrdersCollection().updateOne(
    { _id: attempt.orderDocumentId, orderId: attempt.orderId, solveGeneration: attempt.generation, progress: "solving" },
    { $set: { progress: "failed", updatedAt: new Date() } }
  );
  return result.matchedCount === 1;
}

export async function runOrderSolve(orderId: string, scope: SolveScope = {}): Promise<SolveOrderResult> {
  const collection = getOrdersCollection();
  const generation = randomUUID();
  let attempt: Attempt | undefined;
  let solutionSaved = false;
  let parsed: SolverSolution | undefined;
  try {
    // The returned contents and generation form a single atomic snapshot.
    // Starting another solve supersedes this attempt, while claims cannot
    // start once the order has transitioned out of ready.
    const rawOrder = await collection.findOneAndUpdate(
      { ...scope, orderId, progress: { $nin: ["packing", "packed", "on_hold"] } },
      { $set: { progress: "solving", solveGeneration: generation, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!rawOrder) {
      const exists = await collection.findOne({ ...scope, orderId }, { projection: { _id: 1 } });
      return exists
        ? { ok: false, status: 409, error: "Order is locked for packing." }
        : { ok: false, status: 404, error: "Order not found" };
    }
    attempt = { orderId, orderDocumentId: rawOrder._id, generation };

    let savedOrder: SavedOrder;
    try {
      savedOrder = validateOrder({
        ...rawOrder,
        items: (rawOrder.items ?? []).filter((item: { unavailable?: boolean }) => !item.unavailable),
      });
    } catch (error) {
      if (!(await failSolve(attempt))) throw new StaleSolveError();
      return { ok: false, status: 400, error: error instanceof Error ? error.message : "Invalid order." };
    }
    if (savedOrder.items.length === 0) {
      if (!(await failSolve(attempt))) throw new StaleSolveError();
      return { ok: false, status: 400, error: "No available items to pack." };
    }

    const solverRequest = buildSolverRequest(savedOrder);
    const solverResponse = await postSolverRequest(solverRequest, generation);
    let solverResult: unknown;
    try {
      solverResult = await solverResponse.json();
    } catch {
      throw new SolverSolutionParseError("solver returned invalid JSON");
    }

    if (!solverResponse.ok) {
      if (!(await failSolve(attempt))) throw new StaleSolveError();
      return {
        ok: false,
        status: solverResponse.status,
        error: typeof solverResult === "object" && solverResult !== null && "Error" in solverResult && typeof solverResult.Error === "string"
          ? `Solver failed: ${solverResult.Error}` : "Solver failed",
        solverResult,
      };
    }

    parsed = parseSolverSolution(solverResult);
    validateSolverSolution(parsed, solverRequest);
    if (parsed.unpacked.length > 0) {
      if (!(await failSolve(attempt))) throw new StaleSolveError();
      return { ok: false, status: 422, error: `Solver could not fit: ${describeUnpacked(parsed.unpacked)}`, solverResult };
    }

    const cartons = toVisualiserCartons(parsed, solverRequest);
    await acceptSolution(orderId, rawOrder._id, generation, cartons, parsed);
    solutionSaved = true;

    try {
      await autoAssignOrder(orderId);
    } catch (error) {
      console.error(`Automatic assignment failed for ${orderId}:`, error);
      const current = await collection.findOne(
        { _id: rawOrder._id, solveGeneration: generation, progress: "awaiting_assignment" },
        { projection: { _id: 1 } }
      );
      if (!current) throw new StaleSolveError();
      return {
        ok: false, status: 503,
        error: "Packing layout saved; assignment is pending. A supervisor can retry assignment from Packing when a team member is available.",
      };
    }
    return { ok: true, result: parsed };
  } catch (error) {
    // The solver may deliver the identical result by callback before its HTTP
    // response arrives. Treat that already-committed attempt as idempotent,
    // without writing again or accepting a changed order.
    if (error instanceof StaleSolveError && attempt && parsed) {
      const current = await collection.findOne({
        _id: attempt.orderDocumentId,
        solveGeneration: generation,
        solutionGeneration: generation,
        progress: { $in: ["awaiting_assignment", "ready", "packing", "packed", "on_hold"] },
      }, { projection: { _id: 1, progress: 1 } });
      const stored = current ? await getSolution(orderId) : undefined;
      if (stored?.generation === generation && isDeepStrictEqual(stored.raw, parsed)) {
        // The callback may have committed before attempting assignment. Keep
        // the no-team response honest even when the direct reply arrives first.
        if (current?.progress === "awaiting_assignment") {
          try {
            await autoAssignOrder(orderId);
            const assigned = await collection.findOne({
              _id: attempt.orderDocumentId, solveGeneration: generation, solutionGeneration: generation,
              progress: { $in: ["ready", "packing", "packed", "on_hold"] },
            }, { projection: { _id: 1 } });
            if (!assigned) throw new StaleSolveError();
          } catch (assignmentError) {
            console.error(`Automatic assignment failed for ${orderId}:`, assignmentError);
            const pending = await collection.findOne({
              _id: attempt.orderDocumentId, solveGeneration: generation, progress: "awaiting_assignment",
            }, { projection: { _id: 1 } });
            if (pending) return {
              ok: false, status: 503,
              error: "Packing layout saved; assignment is pending. A supervisor can retry assignment from Packing when a team member is available.",
            };
            return { ok: false, status: 409, error: "The order or solve changed. Generate a new packing layout." };
          }
        }
        return { ok: true, result: parsed };
      }
    }
    if (!solutionSaved && attempt && !(error instanceof StaleSolveError)) {
      try {
        if (!(await failSolve(attempt))) error = new StaleSolveError();
      } catch (progressError) {
        console.error("Failed to update order progress:", progressError);
      }
    }
    if (!(error instanceof StaleSolveError)) console.error(`Order processing failed for ${orderId}:`, error);
    return {
      ok: false,
      status: error instanceof StaleSolveError ? 409 : error instanceof SolverSolutionParseError ? 502 : 500,
      error: error instanceof Error ? error.message : "Could not process order",
    };
  }
}
