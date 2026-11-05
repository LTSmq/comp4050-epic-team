import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";

/**
 * Access guard for /settings (portal-owned; the page itself belongs to the
 * visualiser team and stays a client component).
 *
 * Settings only control how packing results are displayed in the 3D
 * visualiser, which customers cannot open, so customers are sent back to
 * the portal. Logged-out users go to the login page.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "customer") {
    redirect("/portal");
  }

  return children;
}




