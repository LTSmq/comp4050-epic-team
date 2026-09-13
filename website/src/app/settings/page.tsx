"use client";

import { useState } from "react";
import TopNavBar from "@/components/topNavBar/topNavBar";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out failed:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <main className={styles.page}>
      <TopNavBar />
      <div className={styles.container}>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className={styles.signOutButton}
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </main>
  );
}