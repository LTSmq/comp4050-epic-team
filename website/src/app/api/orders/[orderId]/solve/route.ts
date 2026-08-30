import { NextResponse } from "next/server";

import {
  mockOrders,
  mockBoxTypes,
} from "@/lib/solver/mockOrder";

import {
  parseOrderForSolver,
} from "@/lib/solver/parser";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ orderId: string }>;
  }
) {
  try {
    const { orderId } = await context.params;

    const order = mockOrders.find(
      (order) => order.orderId === orderId
    );

    if (!order) {
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

    const solverRequest = parseOrderForSolver(
      order,
      mockBoxTypes
    );

    return NextResponse.json({
      success: true,
      orderId,
      solverRequest,
    });
  } catch (error) {
    console.error("Failed to prepare solver request:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to prepare solver request",
      },
      {
        status: 500,
      }
    );
  }
}
