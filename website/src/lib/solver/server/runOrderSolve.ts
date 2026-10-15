
import {
  getOrdersCollection,
  validateOrder,
} from "@/lib/orders";

import { markOrderProgress } from "@/lib/orders/markProgress";
import { isLocked } from "@/lib/orders/packing";
import { autoAssignOrder } from "@/lib/orders/autoAssign";

import { normaliseSolverResponse } from "@/lib/solver/normaliseResponse";
import { mockBoxTypes } from "@/lib/solver/mockOrder";
import { parseOrderForSolver } from "@/lib/solver/parser";
import { savedOrderToSolverOrder } from "@/lib/solver/orderAdapter";

import {
  parseSolverResponse,
  convertSolverResponseToVisualiser,
} from "@/app/lib/responseParser";

import { saveSolution } from "@/app/lib/solutionStore";

type SolveScope = Record<string, unknown>;

export type SolveOrderResult =
  | {
      ok: true;
      result: ReturnType<typeof parseSolverResponse>;
    }
  | {
      ok: false;
      status: number;
      error: string;
      solverResult?: unknown;
    };

/**
 * Solve an order and automatically assign a packer.
 *
 * Workflow:
 * 1. Retrieve and validate the order.
 * 2. Prevent solving locked orders.
 * 3. Mark order as solving.
 * 4. Request a solution.
 * 5. Save the solution.
 * 6. Automatically assign a packer.
 * 7. Mark order as ready.
 *
 * Orders become ready only after successful assignment.
 */
export async function runOrderSolve(
  orderId: string,
  scope: SolveScope = {}
): Promise<SolveOrderResult> {
  const collection = getOrdersCollection();

  // Tracks whether the solver completed successfully.
  let solutionSaved = false;

  try {
    /* ---------------------------------------------- */
    /* 1. FIND ORDER                                  */
    /* ---------------------------------------------- */

    const rawOrder = await collection.findOne({
      ...scope,
      orderId,
    });

    if (!rawOrder) {
      return {
        ok: false,
        status: 404,
        error: "Order not found",
      };
    }

    /* ---------------------------------------------- */
    /* 2. CHECK LOCK                                  */
    /* ---------------------------------------------- */

    if (isLocked(rawOrder.progress)) {
      return {
        ok: false,
        status: 409,
        error:
          "Order is being packed or already packed.",
      };
    }

    /* ---------------------------------------------- */
    /* 3. VALIDATE ORDER                              */
    /* ---------------------------------------------- */

    const savedOrder = validateOrder({
      ...rawOrder,
      items: (rawOrder.items ?? []).filter(
        (item: { unavailable?: boolean }) =>
          !item.unavailable
      ),
    });

    if (savedOrder.items.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "No available items to pack.",
      };
    }

    /* ---------------------------------------------- */
    /* 4. PREPARE SOLVER REQUEST                      */
    /* ---------------------------------------------- */

    const order =
      savedOrderToSolverOrder(savedOrder);

    const solverRequest = parseOrderForSolver(
      order,
      mockBoxTypes
    );

    await markOrderProgress(
      orderId,
      "solving"
    );

    /* ---------------------------------------------- */
    /* 5. CALL SOLVER                                 */
    /* ---------------------------------------------- */

    const solverResponse = await fetch(
      "http://127.0.0.1:8080/solve",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(solverRequest),
      }
    );

    const solverResult =
      await solverResponse.json();

    if (!solverResponse.ok) {
      await markOrderProgress(
        orderId,
        "failed"
      );

      return {
        ok: false,
        status: solverResponse.status,
        error: "Solver failed",
        solverResult,
      };
    }

    /* ---------------------------------------------- */
    /* 6. PROCESS SOLVER RESPONSE                    */
    /* ---------------------------------------------- */

    const normalised =
      normaliseSolverResponse(solverResult);

    const parsed = parseSolverResponse({
      ...normalised,
      OrderId: orderId,
    });

    const cartons =
      convertSolverResponseToVisualiser(parsed);

    /* ---------------------------------------------- */
    /* 7. SAVE SOLUTION                               */
    /* ---------------------------------------------- */

    await saveSolution(
      orderId,
      cartons,
      parsed
    );

    solutionSaved = true;

    /* ---------------------------------------------- */
    /* 8. AUTOMATIC PACKER ASSIGNMENT                 */
    /* ---------------------------------------------- */

    try {
      await autoAssignOrder(orderId);
    } catch (assignmentError) {
      console.error(
        `Automatic assignment failed for ${orderId}:`,
        assignmentError
      );

      // Keep the saved solution and solving state.
      // Do not incorrectly mark a solved order as
      // a solver failure.
      return {
        ok: false,
        status: 503,
        error:
          assignmentError instanceof Error
            ? `Solution saved, but packer assignment failed: ${assignmentError.message}`
            : "Solution saved, but packer assignment failed.",
      };
    }

    /* ---------------------------------------------- */
    /* 9. MARK READY                                  */
    /* ---------------------------------------------- */

    await markOrderProgress(
      orderId,
      "ready"
    );

    /* ---------------------------------------------- */
    /* 10. RETURN SOLUTION                            */
    /* ---------------------------------------------- */

    return {
      ok: true,
      result: parsed,
    };
  } catch (error) {
    console.error(
      `Order processing failed for ${orderId}:`,
      error
    );

    if (!solutionSaved) {
      try {
        await markOrderProgress(
          orderId,
          "failed"
        );
      } catch (progressError) {
        console.error(
          "Failed to update order progress:",
          progressError
        );
      }
    }

    return {
      ok: false,
      status: 500,
      error:
        error instanceof Error
          ? error.message
          : "Could not process order",
    };
  }
}
