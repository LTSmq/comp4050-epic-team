import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import VisualiserClient from "./VisualiserClient";

export default async function VisualiserPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  // The visualiser is warehouse-only; customers never see packing internals.
  if (user.role === "customer") {
    redirect("/portal");
  }

  return <VisualiserClient />;
}
