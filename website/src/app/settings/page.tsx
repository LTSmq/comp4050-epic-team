"use client";

import { useState } from "react";
import TopNavBar from "@/components/topNavBar/topNavBar";
import styles from "./page.module.css";

interface SettingConfig {
    id: string;
    title: string;
    defaultEnabled: boolean;
}

const SETTINGS: SettingConfig[] = [
    { id: "example setting1", title: "example setting", defaultEnabled: true },
    { id: "example setting2", title: "example setting", defaultEnabled: true },
    { id: "example setting3", title: "example setting", defaultEnabled: true },
    { id: "example setting4", title: "example setting", defaultEnabled: true },
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
    const [settingsState, setSettingsState] = useState<Record<string, boolean>>(
        () => Object.fromEntries(SETTINGS.map((s) => [s.id, s.defaultEnabled]))
    );

    const toggleSetting = (id: string) => {
        setSettingsState((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className={styles.pageBackground}>
            <TopNavBar />
            <div className={styles.settingsContainer}>
                <div className={styles.settingsBox}>
                    {SETTINGS.map((setting) => (
                        <SettingRow
                            key={setting.id}
                            title={setting.title}
                            enabled={settingsState[setting.id]}
                            onToggle={() => toggleSetting(setting.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}