import { NextResponse } from "next/server";
import {
  parseSolverResponse,
  convertSolverResponseToVisualiser,
  SolverResponseParseError,
} from "@/app/lib/responseParser";
import {
  saveSolution,
  getSolution,
  listSolutions,
} from "@/app/lib/solutionStore";
import { markOrderProgress } from "@/lib/orders/markProgress";
import { requireUser, requirePermission, can } from "@/lib/rbac";
import { apiKeyMatches } from "@/lib/apiKey";
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
  if (!apiKeyMatches(apiKey, expected)) {
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

// Visualiser reads. Same scope as the rest of the portal:
// customer -> own orders, team -> assigned orders, supervisor -> all.
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const denied = requirePermission(auth.user, "order:read");
  if (denied) return denied;
  const { user } = auth;

  const scope: Record<string, unknown> =
    user.role === "customer"
      ? { customerId: user.userId }
      : can(user.role, "order:supervise")
        ? {}
        : { assignedUserId: user.userId };
  const orders = client.db(dbName).collection("orders");

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const latest = searchParams.get("latest");

  if (orderId) {
    // Outside the viewer's scope is reported as "not found", so IDs can't be probed.
    const visible = await orders.findOne({ ...scope, orderId }, { projection: { _id: 1 } });
    const sol = visible ? await getSolution(orderId) : undefined;
    if (!sol) {
      return NextResponse.json(
        { success: false, error: `Solution for order '${orderId}' not found` },
        { status: 404, headers: noCacheHeaders }
      );
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
    // Read from the database so it survives restarts and stays within scope.
    const newest = await orders
      .find({ ...scope, solvedAt: { $ne: null } }, { projection: { orderId: 1 } })
      .sort({ updatedAt: -1 })
      .limit(1)
      .next();
    const sol = newest ? await getSolution(String(newest.orderId)) : undefined;
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

  // The full list covers every order -> supervisors only.
  if (!can(user.role, "order:supervise")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403, headers: noCacheHeaders }
    );
  }

  return NextResponse.json(
    { success: true, solutions: listSolutions() },
    { headers: noCacheHeaders }
  );
}