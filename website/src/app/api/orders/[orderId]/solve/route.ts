import { NextResponse } from "next/server";

import {
  requireUser,
  requirePermission,
  orderScope,
} from "@/lib/rbac";
import { runOrderSolve } from "@/lib/solver/server/runOrderSolve";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;

  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }

  // Re-solving resets an order's layout: supervisors only (team packers act on assignments).
  const denied = requirePermission(auth.user, "order:supervise");
  if (denied) {
    return denied;
  }

  const result = await runOrderSolve(
    orderId,
    orderScope(auth.user),
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        ...(result.solverResult !== undefined
          ? { solverResult: result.solverResult }
          : {}),
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    orderId,
    result: result.result,
  });
}
