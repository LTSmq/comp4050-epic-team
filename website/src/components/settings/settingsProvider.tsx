"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

export interface Settings {
  showIsometricGrid: boolean;
  darkMode: boolean;
}

const defaultSettings: Settings = {
  showIsometricGrid: true,
  darkMode: false,
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
    if (saved && typeof saved === "object") {
      const value = saved as Partial<Settings>;
      return {
        showIsometricGrid: typeof value.showIsometricGrid === "boolean" ? value.showIsometricGrid : defaultSettings.showIsometricGrid,
        darkMode: typeof value.darkMode === "boolean" ? value.darkMode : defaultSettings.darkMode,
      };
    }
  } catch {
    // Storage can be unavailable as well as contain malformed JSON.
  }
  return defaultSettings;
}

const subscribeToHydration = () => () => {};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadInitialSettings);
  const hasHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  // Sync the HTML root attribute whenever darkMode changes
  useEffect(() => {
    if (!hasHydrated) return;
    document.documentElement.dataset.theme = settings.darkMode ? "dark" : "light";
    try {
      localStorage.setItem("appSettings", JSON.stringify(settings));
    } catch {
      // Keep settings functional in memory when storage is unavailable.
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
