"use client";

import { useRouter } from "next/navigation";

import styles from "./portal.module.css";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
      });

      if (!response.ok) {
        console.error("Logout failed");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <button
      type="button"
      className={styles.signOutButton}
      onClick={handleLogout}
    >
      Sign out
    </button>
  );
}