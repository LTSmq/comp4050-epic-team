import { NextResponse } from "next/server";
import { requireUser, requirePermission } from "@/lib/rbac";
import { listPackingChanges, listPackingOrders } from "@/lib/orders/packing";

export const dynamic = "force-dynamic";

/** Overlap so writes that land mid-query are never missed (merging is idempotent). */
const OVERLAP_MS = 2000;

/**
 * Packing list feed (team + supervisor).
 *   GET /api/packing                 -> { reset: true,  rows, cursor, now }  full list
 *   GET /api/packing?since=<cursor>  -> { reset: false, rows, cursor, now }  changed rows only
 * cursor/now come from the SERVER clock, so phone clock errors don't matter.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const denied = requirePermission(auth.user, "order:pack");
  if (denied) return denied;

  try {
    const started = new Date();
    const sinceRaw = new URL(request.url).searchParams.get("since");
    const since = sinceRaw ? new Date(sinceRaw) : null;

    let rows = since && !Number.isNaN(since.getTime()) ? await listPackingChanges(since) : null;
    const reset = rows === null;
    if (reset) rows = await listPackingOrders(started);

    return NextResponse.json(
      {
        reset,
        rows,
        cursor: new Date(started.getTime() - OVERLAP_MS).toISOString(),
        now: started.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Packing list failed:", error);
    return NextResponse.json({ error: "Failed to load packing list" }, { status: 500 });
  }
}