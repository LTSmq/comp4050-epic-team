/**
 * Root Gateway Route (`/`)
 *
 * Responsibility:
 * Headless server-side session gateway. Inspects the user's authentication state:
 * - Authenticated users are redirected directly to the portal dashboard (`/portal`).
 * - Unauthenticated visitors are redirected to the sign-in page (`/login`).
 *
 * Important Considerations Before Editing:
 * - Marketing Landing Page: The previous 1,700-line public marketing page was intentionally
 *   decommissioned to streamline enterprise UX and eliminate unnecessary code bloat.
 * - Guest Tools Access: Standalone tools (`/orders` and `/visualiser`) are accessible directly
 *   via their respective URL routes or through navigation once signed in.
 */

import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";

export default async function RootPage() {
  const user = await getAuthUser();
  redirect(user ? "/portal" : "/login");
}