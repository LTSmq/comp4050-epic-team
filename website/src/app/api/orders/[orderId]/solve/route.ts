import { NextResponse } from "next/server";

import { mockOrder } from "@/lib/solver/mockOrder";
import { parseOrderForSolver } from "@/lib/solver/parser";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ orderId: string }>;
  }
) {
  try {
    const { orderId } = await context.params;

    if (mockOrder.orderId !== orderId) {
      return NextResponse.json(
        {
          error: "Order not found",
        },
        {
          status: 404,
        }
      );
    }

    const solverData = parseOrderForSolver(mockOrder);

    return NextResponse.json({
      success: true,
      data: solverData,
    });
  } catch (error) {
    console.error("Failed to prepare order for solver:", error);

    return NextResponse.json(
      {
        error: "Failed to prepare order for solver",
      },
      {
        status: 500,
      }
    );
  }
}