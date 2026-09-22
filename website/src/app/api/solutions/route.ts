import { NextResponse } from "next/server";
import {
  parseSolverResponse,
  convertSolverResponseToVisualiser,
  SolverResponseParseError,
} from "@/app/lib/responseParser";
import {
  saveSolution,
  getSolution,
  getLatestSolution,
  listSolutions,
} from "@/app/lib/solutionStore";
import { markOrderProgress } from "@/lib/orders/markProgress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseSolverResponse(body);
    const orderId = parsed.OrderId || `solve-${Date.now()}`;
    const cartons = convertSolverResponseToVisualiser(parsed);

    await saveSolution(orderId, cartons, parsed);
    await saveSolution(orderId, cartons, parsed);
    // Solution stored → surface it on the order list as "3D ready".
    await markOrderProgress(orderId, "ready");
    return NextResponse.json({ success: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SolverResponseParseError) {
      return NextResponse.json(
        { success: false, error: err.message, path: err.path },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Invalid request payload" },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const latest = searchParams.get("latest");

  if (orderId) {
    const sol = getSolution(orderId);
    if (!sol) {
      return NextResponse.json(
        { success: false, error: `Solution for order '${orderId}' not found` },
        { status: 404, headers: noCacheHeaders }
      );
    }
    return NextResponse.json(
      {
        orderId: sol.orderId,
        cartons: sol.cartons,
        receivedAt: sol.receivedAt,
      },
      { headers: noCacheHeaders }
    );
  }

  if (latest === "true") {
    const sol = getLatestSolution();
    if (!sol) {
      return NextResponse.json(
        { success: false, error: "No solutions available yet" },
        { status: 404, headers: noCacheHeaders }
      );
    }
    return NextResponse.json(
      {
        orderId: sol.orderId,
        cartons: sol.cartons,
        receivedAt: sol.receivedAt,
      },
      { headers: noCacheHeaders }
    );
  }

  return NextResponse.json(
    {
      success: true,
      solutions: listSolutions(),
    },
    { headers: noCacheHeaders }
  );
}

