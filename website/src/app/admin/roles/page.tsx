import { redirect } from "next/navigation";

import TopNavBar from "@/components/topNavBar/topNavBar";
import { getAuthUser } from "@/lib/auth";
import RoleManager from "./RoleManager";

export default async function RolesPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "supervisor") {
    redirect("/portal");
  }

  return (
    <>
      <TopNavBar />
      <RoleManager currentUserId={user.userId} />
    </>
  );
}