/**
 * Packing list (`/packing`) — the navbar "Orders" button for team and supervisors.
 * First list is rendered on the server (instant, no spinner); PackingList keeps it live.
 */
import { redirect } from "next/navigation";
import TopNavBar from "@/components/topNavBar/topNavBar";
import { getAuthUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listPackingOrders } from "@/lib/orders/packing";
import PackingList from "./PackingList";

export const dynamic = "force-dynamic";

export default async function PackingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!can(user.role, "order:pack")) redirect("/portal");

  const started = new Date();
  const rows = await listPackingOrders(started);

  return (
    <>
      <TopNavBar />
      <PackingList
        role={user.role}
        userId={user.userId}
        initialRows={rows}
        initialNow={started.toISOString()}
        initialCursor={new Date(started.getTime() - 2000).toISOString()}
      />
    </>
  );
}