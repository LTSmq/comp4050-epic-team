'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface Settings {
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

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse local storage settings:', e);
      }
    }
  }, []);

  const toggleSetting = (key: keyof Settings) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('appSettings', JSON.stringify(updated));
      return updated;
    });
  };

  if (!isMounted) return <>{children}</>;

  return (
    <SettingsContext.Provider value={{ settings, toggleSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);