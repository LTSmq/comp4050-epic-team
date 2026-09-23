/**
 * Order screen for packers (`/packing/:orderId`): everything about the order,
 * its 3D layout link, and the pack buttons.
 */
import { notFound, redirect } from "next/navigation";
import TopNavBar from "@/components/topNavBar/topNavBar";
import { getAuthUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getPackingOrder } from "@/lib/orders/packing";
import PackingOrder from "./PackingOrder";

export const dynamic = "force-dynamic";

export default async function PackingOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!can(user.role, "order:pack")) redirect("/portal");

  const { orderId } = await params;
  const order = await getPackingOrder(decodeURIComponent(orderId));
  if (!order) notFound();

  return (
    <>
      <TopNavBar />
      <PackingOrder
        initial={order}
        initialNow={new Date().toISOString()}
        role={user.role}
        userId={user.userId}
      />
    </>
  );
}