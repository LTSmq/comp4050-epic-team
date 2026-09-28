import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth";

import {
  normaliseSolverResponse,
} from "@/lib/solver/normaliseResponse";

import {
  getOrdersCollection,
  validateOrder,
} from "@/lib/orders";

import {
  mockBoxTypes,
} from "@/lib/solver/mockOrder";

import {
  parseOrderForSolver,
} from "@/lib/solver/parser";

import {
  savedOrderToSolverOrder,
} from "@/lib/solver/orderAdapter";

import {
  parseSolverResponse,
  convertSolverResponseToVisualiser,
} from "@/app/lib/responseParser";

import {
  saveSolution,
} from "@/app/lib/solutionStore";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      orderId: string;
    }>;
  }
) {
  try {
    const user =
      await getAuthUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorised",
        },
        {
          status: 401,
        }
      );
    }

    const { orderId } =
      await context.params;

    /* =====================================
       LOAD REAL SAVED ORDER
       ===================================== */

    const collection =
      getOrdersCollection();

    const rawOrder =
      await collection.findOne({
        ownerUserId:
          user.userId,
        orderId,
      });

    if (!rawOrder) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found",
        },
        {
          status: 404,
        }
      );
    }

    const savedOrder =
      validateOrder(rawOrder);

    const order =
      savedOrderToSolverOrder(
        savedOrder
      );

    /* =====================================
       PREPARE SOLVER REQUEST
       ===================================== */

    const solverRequest =
      parseOrderForSolver(
        order,
        mockBoxTypes
      );

    /* =====================================
       SEND TO SOLVER
       ===================================== */

    const solverResponse =
      await fetch(
        "http://127.0.0.1:8080/solve",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            solverRequest
          ),
        }
      );

    const solverResult =
      await solverResponse.json();

    if (!solverResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Solver failed",
          solverResult,
        },
        {
          status:
            solverResponse.status,
        }
      );
    }

    /* =====================================
       ASSOCIATE SOLUTION WITH ORDER
       ===================================== */

    const normalised =
  normaliseSolverResponse(
    solverResult
  );

    const solverPayload = {
   ...normalised,
    OrderId: orderId,
};

    const parsed =
      parseSolverResponse(
        solverPayload
      );

    const cartons =
      convertSolverResponseToVisualiser(
        parsed
      );

    /* =====================================
       SAVE FOR VISUALISER
       ===================================== */

    await saveSolution(
      orderId,
      cartons,
      parsed
    );

    return NextResponse.json({
      success: true,
      orderId,
      result: parsed,
    });
  } catch (error) {
    console.error(
      "Solver connection failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not connect to solver",
      },
      {
        status: 500,
      }
    );
  }
}