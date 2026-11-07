import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";

/**
 * Access guard for /settings (portal-owned; the page itself belongs to the
 * visualiser team and stays a client component).
 *
 * Settings include site-wide appearance preferences for all users.
 * Logged-out users go to the login page.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return children;
}




