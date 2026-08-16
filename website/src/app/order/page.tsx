import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import OrderForm from "./OrderForm";

export default async function OrderPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <OrderForm username={user.username} />;
}