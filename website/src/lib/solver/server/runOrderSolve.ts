import { getOrdersCollection, validateOrder } from "@/lib/orders";
import { markOrderProgress } from "@/lib/orders/markProgress";
import { isLocked } from "@/lib/orders/packing";

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

export async function runOrderSolve(
  orderId: string,
  scope: SolveScope = {},
): Promise<SolveOrderResult> {
  try {
    const collection = getOrdersCollection();

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

    if (isLocked(rawOrder.progress)) {
      return {
        ok: false,
        status: 409,
        error: "Order is being packed or already packed.",
      };
    }

    const savedOrder = validateOrder({
      ...rawOrder,
      items: (rawOrder.items ?? []).filter(
        (item: { unavailable?: boolean }) => !item.unavailable,
      ),
    });

    if (savedOrder.items.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "No available items to pack.",
      };
    }

    const order = savedOrderToSolverOrder(savedOrder);
    const solverRequest = parseOrderForSolver(order, mockBoxTypes);

    await markOrderProgress(orderId, "solving");

    const solverResponse = await fetch("http://127.0.0.1:8080/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(solverRequest),
    });

    const solverResult = await solverResponse.json();

    if (!solverResponse.ok) {
      await markOrderProgress(orderId, "failed");

      return {
        ok: false,
        status: solverResponse.status,
        error: "Solver failed",
        solverResult,
      };
    }

    const normalised = normaliseSolverResponse(solverResult);

    const parsed = parseSolverResponse({
      ...normalised,
      OrderId: orderId,
    });

    const cartons = convertSolverResponseToVisualiser(parsed);

    await saveSolution(orderId, cartons, parsed);
    await markOrderProgress(orderId, "ready");

    return {
      ok: true,
      result: parsed,
    };
  } catch (error) {
    console.error("Solver connection failed:", error);

    await markOrderProgress(orderId, "failed");

    return {
      ok: false,
      status: 500,
      error:
        error instanceof Error
          ? error.message
          : "Could not connect to solver",
    };
  }
}
