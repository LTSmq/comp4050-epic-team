"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./account.module.css";

export default function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await fetch("/api/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
      setIsSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className={styles.signOutButton}
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}