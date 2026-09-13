/**
 * OrdersPage Component (`/orders`)
 *
 * Responsibility:
 * Server component route entry point for the Orders desk. Handles server-side
 * authentication retrieval and mounts the global floating `<TopNavBar />` alongside `<OrderForm />`
 */

import TopNavBar from "@/components/topNavBar/topNavBar";
import { getAuthUser } from "@/lib/auth";
import OrderForm from "./OrderForm";

export default async function OrdersPage() {
  const user = await getAuthUser();

  return (
    <>
      <TopNavBar />
      <OrderForm username={user?.username} />
    </>
  );
}
