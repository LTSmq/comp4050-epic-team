import { NextResponse } from "next/server";

import { requireUser, requirePermission, orderScope } from "@/lib/rbac";
import { markOrderProgress } from "@/lib/orders/markProgress";
import { isLocked } from "@/lib/orders/packing";

import { normaliseSolverResponse } from "@/lib/solver/normaliseResponse";
import { getOrdersCollection, validateOrder } from "@/lib/orders";
import { mockBoxTypes } from "@/lib/solver/mockOrder";
import { parseOrderForSolver } from "@/lib/solver/parser";
import { savedOrderToSolverOrder } from "@/lib/solver/orderAdapter";
import {
  parseSolverResponse,
  convertSolverResponseToVisualiser,
} from "@/app/lib/responseParser";
import { saveSolution } from "@/app/lib/solutionStore";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params; // outside try so catch can mark "failed"

  try {
    // Staff only (team + supervisor)
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;
    const denied = requirePermission(user, "order:pack");
    if (denied) return denied;

    /* LOAD REAL SAVED ORDER */
    const collection = getOrdersCollection();
    const rawOrder = await collection.findOne({ ...orderScope(user), orderId });

    if (!rawOrder) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Never re-solve while the warehouse is packing it
    if (isLocked(rawOrder.progress)) {
      return NextResponse.json(
        { success: false, error: "Order is being packed or already packed." },
        { status: 409 }
      );
    }

    // Skip items flagged unavailable (supervisor "resolve" flow)
    const savedOrder = validateOrder({
      ...rawOrder,
      items: (rawOrder.items ?? []).filter(
        (item: { unavailable?: boolean }) => !item.unavailable
      ),
    });

    if (savedOrder.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No available items to pack." },
        { status: 400 }
      );
    }

    const order = savedOrderToSolverOrder(savedOrder);

    /* PREPARE SOLVER REQUEST */
    const solverRequest = parseOrderForSolver(order, mockBoxTypes);

    await markOrderProgress(orderId, "solving");

    /* SEND TO SOLVER */
    const solverResponse = await fetch("http://127.0.0.1:8080/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(solverRequest),
    });

    const solverResult = await solverResponse.json();

    if (!solverResponse.ok) {
      await markOrderProgress(orderId, "failed");
      return NextResponse.json(
        { success: false, error: "Solver failed", solverResult },
        { status: solverResponse.status }
      );
    }

    /* ASSOCIATE SOLUTION WITH ORDER */
    const normalised = normaliseSolverResponse(solverResult);
    const solverPayload = { ...normalised, OrderId: orderId };
    const parsed = parseSolverResponse(solverPayload);
    const cartons = convertSolverResponseToVisualiser(parsed);

    /* SAVE FOR VISUALISER */
    await saveSolution(orderId, cartons, parsed);
    await markOrderProgress(orderId, "ready"); // appears on packing list

    return NextResponse.json({ success: true, orderId, result: parsed });
  } catch (error) {
    console.error("Solver connection failed:", error);
    await markOrderProgress(orderId, "failed");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not connect to solver",
      },
      { status: 500 }
    );
  }
}