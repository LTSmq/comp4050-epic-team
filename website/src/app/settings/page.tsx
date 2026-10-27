"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopNavBar from "@/components/topNavBar/topNavBar";
import pageStyles from "./page.module.css";
import settingsStyles from "./settings.module.css";
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
    <label className={pageStyles.settingsRow}>
      <span className={pageStyles.settingLabel}>{title}</span>
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className={pageStyles.settingCheckbox}
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
    <main className={`${settingsStyles.page} ${pageStyles.pageBackground}`}>
      <TopNavBar />
      <div className={pageStyles.settingsContainer}>
        <div className={pageStyles.settingsBox}>
          {SETTINGS.map((setting) => (
            <SettingRow
              key={setting.id}
              title={setting.title}
              enabled={settings[setting.id]}
              onToggle={() => toggleSetting(setting.id)}
            />
          ))}
        </div>
      </div>
      <div className={settingsStyles.container}>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className={settingsStyles.signOutButton}
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </main>
  );
}
