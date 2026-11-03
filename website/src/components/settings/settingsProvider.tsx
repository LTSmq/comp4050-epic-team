"use client";

import { createContext, useContext, useEffect, useState } from "react";

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
  const saved = localStorage.getItem("appSettings");
  if (saved) {
    try {
      return { ...defaultSettings, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Failed to parse local storage settings:", e);
    }
  }
  return defaultSettings;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadInitialSettings);

  // Sync the HTML root attribute whenever darkMode changes
  useEffect(() => {
    document.documentElement.dataset.theme = settings.darkMode ? "dark" : "light";
  }, [settings.darkMode]);

  const toggleSetting = (key: keyof Settings) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem("appSettings", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, toggleSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);