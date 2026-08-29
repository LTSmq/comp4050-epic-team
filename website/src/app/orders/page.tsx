import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth";
import OrderForm from "./OrderForm";

export default async function OrderPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return <OrderForm username={user.username} />;
}