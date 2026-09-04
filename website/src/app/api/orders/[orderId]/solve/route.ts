import { NextResponse } from "next/server";

import {
  mockOrders,
  mockBoxTypes,
} from "@/lib/solver/mockOrder";

import {
  parseOrderForSolver,
} from "@/lib/solver/parser";

import client from "@/lib/mongodb"; // <-- ADDED

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
        { status: 404 }
      );
    }

    const solverRequest = parseOrderForSolver(
      order,
      mockBoxTypes
    );

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

    const solverResult = await solverResponse.json();

    if (!solverResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Solver failed",
          solverResult,
        },
        { status: solverResponse.status }
      );
    }

    // --- ADDED: save the solved result to MongoDB ---
    const dbName = process.env.MONGODB_DB;
    if (!dbName) {
      throw new Error("Please define MONGODB_DB in .env.local");
    }

    const db = client.db(dbName);
    const solvedOrders = db.collection("solved_orders");

    await solvedOrders.updateOne(
      { orderId },
      {
        $set: {
          orderId,
          result: solverResult,
          solvedAt: new Date(),
        },
      },
      { upsert: true }
    );
    // --- END ADDED ---

    return NextResponse.json({
      success: true,
      orderId,
      result: solverResult,
    });

  } catch (error) {
    console.error("Solver connection failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not connect to solver",
      },
      { status: 500 }
    );
  }
}