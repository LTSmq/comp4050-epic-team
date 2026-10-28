"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopNavBar from "@/components/topNavBar/topNavBar";
import styles from "./settings.module.css";
import { useSettings, type Settings } from "@/components/settings/settingsProvider";

interface SettingConfig {
  id: keyof Settings;
  title: string;
}

const SETTINGS: SettingConfig[] = [
  { id: "showIsometricGrid", title: "Isometric Grid Background" },
];

function SettingRow({
  title,
  enabled,
  onToggle,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={styles.settingsRow}>
      <span className={styles.settingLabel}>{title}</span>
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className={styles.settingCheckbox}
      />
    </label>
  );
}

export default function SettingsPage() {
  const { settings, toggleSetting } = useSettings();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await fetch("/api/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <main className={styles.page}>
      <TopNavBar />
      <div className={styles.container}>
        <div className={styles.introduction}>
          <h1>Settings</h1>
          <p>Choose how packing results are displayed.</p>
        </div>
        <div className={styles.settingsBox}>
          {SETTINGS.map((setting) => (
            <SettingRow
              key={setting.id}
              title={setting.title}
              enabled={settings[setting.id]}
              onToggle={() => toggleSetting(setting.id)}
            />
          ))}
        </div>
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
