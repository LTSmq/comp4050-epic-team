
import { NextResponse } from "next/server";

import {
  requireUser,
  requirePermission,
} from "@/lib/rbac";

import { can } from "@/lib/rbac";

import {
  listPackingChanges,
  listPackingOrders,
} from "@/lib/orders/packing";

export const dynamic = "force-dynamic";

/**
 * Overlap polling queries by two seconds.
 * This helps avoid missing updates during polling.
 */
const OVERLAP_MS = 2000;

/**
 * Packing list API.
 *
 * GET /api/packing
 *   Returns the full packing list.
 *
 * GET /api/packing?since=<cursor>
 *   Returns changed orders.
 *
 * Access rules:
 * - Team members only see assigned orders.
 * - Supervisors can see all orders.
 * - Customers cannot access this endpoint.
 */
export async function GET(request: Request) {
  /* ---------------------------------------------- */
  /* 1. AUTHENTICATION                              */
  /* ---------------------------------------------- */

  const auth = await requireUser();

  if (!auth.ok) {
    return auth.response;
  }

  const denied = requirePermission(
    auth.user,
    "order:pack"
  );

  if (denied) {
    return denied;
  }

  /* ---------------------------------------------- */
  /* 2. DETERMINE ACCESS SCOPE                      */
  /* ---------------------------------------------- */

  const supervisor = can(
    auth.user.role,
    "order:supervise"
  );

  // Supervisors see all orders.
  // Team members only see their own assignments.
  const assignedUserId = supervisor
    ? undefined
    : auth.user.userId;

  /* ---------------------------------------------- */
  /* 3. LOAD PACKING ORDERS                         */
  /* ---------------------------------------------- */

  try {
    const started = new Date();

    const url = new URL(request.url);
    const sinceRaw = url.searchParams.get("since");

    const since = sinceRaw
      ? new Date(sinceRaw)
      : null;

    const validSince =
      since !== null &&
      !Number.isNaN(since.getTime());

    let rows = validSince
      ? await listPackingChanges(
          since,
          assignedUserId
        )
      : null;

    const reset = rows === null;

    if (reset) {
      rows = await listPackingOrders(
        started,
        assignedUserId
      );
    }

    /* -------------------------------------------- */
    /* 4. RETURN RESPONSE                           */
    /* -------------------------------------------- */

    return NextResponse.json(
      {
        reset,
        rows,

        cursor: new Date(
          started.getTime() - OVERLAP_MS
        ).toISOString(),

        now: started.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Packing list failed:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load packing list",
      },
      {
        status: 500,
      }
    );
  }
}
