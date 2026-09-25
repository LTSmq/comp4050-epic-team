/**
 * OrdersPage Component (`/orders`)
 *
 * Responsibility:
 * Server component route entry point for the Orders desk. Handles server-side
 * authentication retrieval and mounts the global floating `<TopNavBar />` alongside `<OrderForm />`
 */

import TopNavBar from "@/components/topNavBar/topNavBar";
import OrderForm from "./OrderForm";

export default function OrdersPage() {
  return (
    <>
      <TopNavBar />
      <OrderForm />
    </>
  );
}
