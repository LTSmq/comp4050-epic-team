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
import { requireUser, requirePermission } from "@/lib/rbac";
import client from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};
const dbName = process.env.MONGODB_DB || "fitvisualizer";

// Solver -> portal ingestion. Machine-to-machine, shared key (same pattern as /orders/intake).
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.SOLVER_API_KEY;
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
  }

  try {
    const parsed = parseSolverResponse(await request.json());
    const orderId = parsed.OrderId || `solve-${Date.now()}`;
    const cartons = convertSolverResponseToVisualiser(parsed);

    await saveSolution(orderId, cartons, parsed);
    await markOrderProgress(orderId, "ready");
    return NextResponse.json({ success: true }, { headers: noCacheHeaders });
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

// Visualiser reads. Authenticated; customers only ever see their own order's solution.
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const denied = requirePermission(auth.user, "order:read");
  if (denied) return denied;
  const { user } = auth;

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
    if (user.role === "customer") {
      const owns = await client
        .db(dbName)
        .collection("orders")
        .findOne({ orderId, customerId: user.userId }, { projection: { _id: 1 } });
      if (!owns) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403, headers: noCacheHeaders }
        );
      }
    }
    return NextResponse.json(
      { orderId: sol.orderId, cartons: sol.cartons, receivedAt: sol.receivedAt },
      { headers: noCacheHeaders }
    );
  }

  // "latest" and the full list expose every order -> staff only.
  if (user.role === "customer") {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403, headers: noCacheHeaders }
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
      { orderId: sol.orderId, cartons: sol.cartons, receivedAt: sol.receivedAt },
      { headers: noCacheHeaders }
    );
  }

  return NextResponse.json(
    { success: true, solutions: listSolutions() },
    { headers: noCacheHeaders }
  );
}