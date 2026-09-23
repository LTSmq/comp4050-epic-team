/**
 * OrdersPage Component (`/orders`)
 *
 * Responsibility:
 * Server component route entry point for the Orders desk. Handles server-side
 * authentication retrieval and mounts the global floating `<TopNavBar />` alongside `<OrderForm />`
 */

import { redirect } from "next/navigation";
import TopNavBar from "@/components/topNavBar/topNavBar";
import { getAuthUser } from "@/lib/auth";
import OrderForm from "./OrderForm";

export default async function OrdersPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  // Order desk is for customers and supervisors. Packers use the packing list.
  if (user.role === "team") redirect("/packing");

  return (
    <>
      <TopNavBar />
      <OrderForm username={user?.username} />
    </>
  );
}

