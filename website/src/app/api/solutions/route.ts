import { NextResponse } from "next/server";
import {
  describeUnpacked,
  parseSolverSolution,
  validateSolverSolution,
  toVisualiserCartons,
  SolverSolutionParseError,
} from "@/lib/solver/solution";
import { buildSolverRequest } from "@/lib/solver/request";
import { getOrdersCollection, validateOrder } from "@/lib/orders";
import {
  acceptSolution,
  getSolution,
  listSolutions,
  StaleSolveError,
} from "@/app/lib/solutionStore";
import { failSolve } from "@/lib/solver/server/runOrderSolve";
import { autoAssignOrder } from "@/lib/orders/autoAssign";
import { requireUser, requirePermission, can, orderScope } from "@/lib/rbac";
import { apiKeyMatches } from "@/lib/apiKey";
import client, { mongoReady } from "@/lib/mongodb";

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

  // A body alone cannot identify which of several solves produced it.
  // Only an active generation can be accepted, including by another process.
  const generation = request.headers.get("x-solve-generation");
  if (!generation) {
    return NextResponse.json({ success: false, error: "Missing solve generation." }, { status: 409 });
  }

  let attempt: Parameters<typeof failSolve>[0] | undefined;
  try {
    await mongoReady;
    // Reply shape: solver/docs/output_schema.md ({ id, packages, unpacked }).
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
    }
    const parsed = parseSolverSolution(body);
    const orderId = parsed.id;

    // The solution carries geometry only; weights, groups and carton
    // references come from the order, rebuilt into the request we'd send.
    const rawOrder = await getOrdersCollection().findOne({ orderId, solveGeneration: generation, progress: "solving" });
    if (!rawOrder) {
      return NextResponse.json(
        { success: false, error: "The order or solve changed. Generate a new packing layout." },
        { status: 409 }
      );
    }
    attempt = { orderId, orderDocumentId: rawOrder._id, generation };

    const savedOrder = validateOrder({
      ...rawOrder,
      items: (rawOrder.items ?? []).filter(
        (item: { unavailable?: boolean }) => !item.unavailable
      ),
    });
    if (savedOrder.items.length === 0) {
      throw new SolverSolutionParseError("order has no available items");
    }
    const solverRequest = buildSolverRequest(savedOrder);
    validateSolverSolution(parsed, solverRequest);

    // Same rule as runOrderSolve: never hand packers a partial layout.
    if (parsed.unpacked.length > 0) {
      if (!(await failSolve(attempt))) throw new StaleSolveError();
      return NextResponse.json(
        {
          success: false,
          error: `Solver could not fit: ${describeUnpacked(parsed.unpacked)}`,
        },
        { status: 422 }
      );
    }

    const cartons = toVisualiserCartons(parsed, solverRequest);

    await acceptSolution(orderId, rawOrder._id, generation, cartons, parsed);
    try {
      await autoAssignOrder(orderId);
    } catch (error) {
      console.error(`Automatic assignment failed for ${orderId}:`, error);
      const pending = await getOrdersCollection().findOne({
        _id: rawOrder._id, solveGeneration: generation, progress: "awaiting_assignment",
      }, { projection: { _id: 1 } });
      if (!pending) throw new StaleSolveError();
      return NextResponse.json(
        { success: false, error: "Packing layout saved; assignment is pending. A supervisor can retry assignment from Packing when a team member is available." },
        { status: 503, headers: noCacheHeaders }
      );
    }
    return NextResponse.json({ success: true }, { headers: noCacheHeaders });
  } catch (err) {
    if (err instanceof SolverSolutionParseError) {
      return NextResponse.json(
        { success: false, error: err.message, path: err.path },
        { status: 400 }
      );
    }
    if (err instanceof StaleSolveError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    }
    if (attempt) {
      try { await failSolve(attempt); } catch (error) { console.error("Failed to mark solve failed:", error); }
    }
    console.error("Failed to ingest solution:", err);
    return NextResponse.json(
      { success: false, error: "Could not persist solution." },
      { status: 500 }
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
      ? orderScope(user)
      : can(user.role, "order:supervise")
        ? {}
        : { assignedUserId: user.userId };
  const orders = client.db(dbName).collection("orders");

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const latest = searchParams.get("latest");

  if (orderId) {
    // Outside the viewer's scope is reported as "not found", so IDs can't be probed.
    const visible = await orders.findOne({ ...scope, orderId, progress: { $in: ["ready", "packing", "packed", "on_hold", "awaiting_assignment"] }, solvedAt: { $ne: null } }, { projection: { _id: 1 } });
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
      .find({ ...scope, progress: { $in: ["ready", "packing", "packed", "on_hold", "awaiting_assignment"] }, solvedAt: { $ne: null } }, { projection: { orderId: 1 } })
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
    { success: true, solutions: await listSolutions() },
    { headers: noCacheHeaders }
  );
}
