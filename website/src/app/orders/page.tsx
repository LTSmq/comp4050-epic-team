import { getAuthUser } from "@/lib/auth";
import OrderForm from "./OrderForm";

export default async function OrdersPage() {
  const user = await getAuthUser();

  return <OrderForm username={user?.username} />;
}
