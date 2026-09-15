"use client";

import TopNavBar from "@/components/topNavBar/topNavBar";
import styles from "./page.module.css";
import { useSettings } from "./settingsProvider";

interface SettingConfig {
    id: "showIsometricGrid";
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

    return (
        <div className={styles.pageBackground}>
            <TopNavBar />
            <div className={styles.settingsContainer}>
                <div className={styles.settingsBox}>
                    {SETTINGS.map((setting) => (
                        <SettingRow
                            key={setting.id}
                            title={setting.title}
                            enabled={!!settings[setting.id]}
                            onToggle={() => toggleSetting(setting.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}