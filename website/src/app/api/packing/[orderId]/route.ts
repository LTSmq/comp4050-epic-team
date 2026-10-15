
import { NextResponse } from "next/server";

import {
  requireUser,
  requirePermission,
  can,
} from "@/lib/rbac";

import {
  PACK_ACTIONS,
  PackingError,
  getPackingOrder,
  runPackAction,
} from "@/lib/orders/packing";

import type { PackAction } from "@/lib/orders/progress";

import { runOrderSolve } from "@/lib/solver/server/runOrderSolve";

export const dynamic = "force-dynamic";

type Ctx = {
  params: Promise<{ orderId: string }>;
};

const NO_STORE = {
  "Cache-Control": "no-store",
};

/**
 * GET /api/packing/:orderId
 *
 * Team: only assigned orders.
 * Supervisor: all orders.
 *
 * Returns:
 * 200 { order, now }
 * 204 unchanged
 * 404 not found or not assigned
 */
export async function GET(
  request: Request,
  context: Ctx
) {
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

  const { orderId } = await context.params;

  const supervisor = can(
    auth.user.role,
    "order:supervise"
  );

  const userId = supervisor
    ? undefined
    : auth.user.userId;

  try {
    const order = await getPackingOrder(
      orderId,
      userId
    );

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        {
          status: 404,
          headers: NO_STORE,
        }
      );
    }

    const since = new URL(
      request.url
    ).searchParams.get("since");

    if (
      since &&
      order.updatedAt === since
    ) {
      return new NextResponse(null, {
        status: 204,
        headers: NO_STORE,
      });
    }

    return NextResponse.json(
      {
        order,
        now: new Date().toISOString(),
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error(
      "Failed to retrieve packing order:",
      error
    );

    return NextResponse.json(
      { error: "Failed to load order" },
      {
        status: 500,
        headers: NO_STORE,
      }
    );
  }
}

/**
 * POST /api/packing/:orderId
 *
 * Body:
 * {
 *   action: PackAction,
 *   itemIndex?: number
 * }
 *
 * Team members may act only on their own
 * assigned orders.
 *
 * Supervisors may manage all orders.
 */
export async function POST(
  request: Request,
  context: Ctx
) {
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

  const { orderId } = await context.params;

  const supervisor = can(
    auth.user.role,
    "order:supervise"
  );

  const userId = supervisor
    ? undefined
    : auth.user.userId;

  /* ---------------------------------------------- */
  /* 2. VALIDATE REQUEST                            */
  /* ---------------------------------------------- */

  let body: {
    action?: unknown;
    itemIndex?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const action = body.action as PackAction;

  if (!PACK_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  }

  const itemIndex =
    body.itemIndex === undefined
      ? undefined
      : Number(body.itemIndex);

  if (
    action === "unavailable" &&
    (
      itemIndex === undefined ||
      !Number.isInteger(itemIndex) ||
      itemIndex < 0
    )
  ) {
    return NextResponse.json(
      { error: "Valid itemIndex is required" },
      { status: 400 }
    );
  }

  /* ---------------------------------------------- */
  /* 3. CHECK ORDER ACCESS                          */
  /* ---------------------------------------------- */

  try {
    const accessibleOrder =
      await getPackingOrder(
        orderId,
        userId
      );

    if (!accessibleOrder) {
      return NextResponse.json(
        {
          error:
            "Order not found or not assigned to you.",
        },
        {
          status: 404,
          headers: NO_STORE,
        }
      );
    }

    /* -------------------------------------------- */
    /* 4. EXECUTE PACKING ACTION                    */
    /* -------------------------------------------- */

    let order = await runPackAction(
      auth.user,
      orderId,
      action,
      itemIndex
    );

    /* -------------------------------------------- */
    /* 5. SUPERVISOR RE-SOLVE                       */
    /* -------------------------------------------- */

    if (action === "resolve") {
      const solved = await runOrderSolve(
        orderId
      );

      if (!solved.ok) {
        return NextResponse.json(
          { error: solved.error },
          {
            status: solved.status,
            headers: NO_STORE,
          }
        );
      }

      const refreshed =
        await getPackingOrder(orderId);

      if (refreshed) {
        order = refreshed;
      }
    }

    /* -------------------------------------------- */
    /* 6. RETURN UPDATED ORDER                      */
    /* -------------------------------------------- */

    return NextResponse.json(
      {
        order,
        now: new Date().toISOString(),
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    if (error instanceof PackingError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: NO_STORE,
        }
      );
    }

    console.error(
      `Packing action ${action} failed:`,
      error
    );

    return NextResponse.json(
      { error: "Action failed" },
      {
        status: 500,
        headers: NO_STORE,
      }
    );
  }
}
