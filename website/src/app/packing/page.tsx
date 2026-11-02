
/**
 * Packing list (/packing).
 *
 * Team members see only their assigned orders.
 * Supervisors see all packing orders.
 *
 * The initial list is rendered on the server.
 * PackingList keeps the list updated through polling.
 */

import { redirect } from "next/navigation";

import TopNavBar from "@/components/topNavBar/topNavBar";
import { getAuthUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listPackingOrders } from "@/lib/orders/packing";

import PackingList from "./PackingList";

export const dynamic = "force-dynamic";

export default async function PackingPage() {
  /* ---------------------------------------------- */
  /* 1. AUTHENTICATION                              */
  /* ---------------------------------------------- */

  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (!can(user.role, "order:pack")) {
    redirect("/portal");
  }

  /* ---------------------------------------------- */
  /* 2. DETERMINE USER ACCESS                       */
  /* ---------------------------------------------- */

  const supervisor = can(
    user.role,
    "order:supervise"
  );

  // Supervisors see all orders.
  // Team members see only their own assignments.
  const assignedUserId = supervisor
    ? undefined
    : user.userId;

  /* ---------------------------------------------- */
  /* 3. LOAD INITIAL PACKING LIST                   */
  /* ---------------------------------------------- */

  const started = new Date();

  const rows = await listPackingOrders(
    started,
    assignedUserId
  );

  /* ---------------------------------------------- */
  /* 4. RENDER PAGE                                 */
  /* ---------------------------------------------- */

  return (
    <>
      <TopNavBar />

      <PackingList
        role={user.role}
        userId={user.userId}
        initialRows={rows}
        initialNow={started.toISOString()}
        initialCursor={new Date(
          started.getTime() - 2000
        ).toISOString()}
      />
    </>
  );
}
