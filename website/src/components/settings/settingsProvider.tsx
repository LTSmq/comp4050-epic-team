"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

export interface Settings {
  showIsometricGrid: boolean;
}

const defaultSettings: Settings = {
  showIsometricGrid: true,
};

const SettingsContext = createContext<{
  settings: Settings;
  toggleSetting: (key: keyof Settings) => void;
}>({
  settings: defaultSettings,
  toggleSetting: () => {},
});

function loadInitialSettings(): Settings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("appSettings") ?? "null");
    if (saved && typeof saved === "object" && "showIsometricGrid" in saved &&
        typeof saved.showIsometricGrid === "boolean") {
      return { showIsometricGrid: saved.showIsometricGrid };
    }
  } catch (error) {
    console.error("Failed to load local storage settings:", error);
  }
  return defaultSettings;
}

const subscribeToHydration = () => () => {};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadInitialSettings);
  // Match the server's defaults until hydration has finished.
  const hasHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      localStorage.setItem("appSettings", JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save local storage settings:", error);
    }
  }, [settings, hasHydrated]);

  const toggleSetting = (key: keyof Settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <SettingsContext.Provider value={{ settings: hasHydrated ? settings : defaultSettings, toggleSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
