import { NextResponse } from "next/server";
import { requireUser, requirePermission } from "@/lib/rbac";
import {
  PACK_ACTIONS,
  PackingError,
  getPackingOrder,
  runPackAction,
} from "@/lib/orders/packing";
import type { PackAction } from "@/lib/orders/progress";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orderId: string }> };

/**
 * GET /api/packing/:orderId[?since=<updatedAt>]
 * 200 { order, now } | 204 unchanged (saves battery/data) | 404
 */
export async function GET(request: Request, context: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const denied = requirePermission(auth.user, "order:pack");
  if (denied) return denied;

  const { orderId } = await context.params;
  const order = await getPackingOrder(orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const since = new URL(request.url).searchParams.get("since");
  if (since && order.updatedAt === since) {
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { order, now: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * POST /api/packing/:orderId  { action, itemIndex? }
 * claim | release | packed | unavailable (itemIndex) | restore | resolve | reopen
 * 200 { order, now } | 400 | 403 | 404 | 409 { error: "Being packed by Ali." }
 */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { orderId } = await context.params;

  let body: { action?: unknown; itemIndex?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action as PackAction;
  if (!PACK_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const order = await runPackAction(
      auth.user,
      orderId,
      action,
      body.itemIndex === undefined ? undefined : Number(body.itemIndex)
    );
    return NextResponse.json({ order, now: new Date().toISOString() });
  } catch (err) {
    if (err instanceof PackingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`Pack action ${action} failed:`, err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}