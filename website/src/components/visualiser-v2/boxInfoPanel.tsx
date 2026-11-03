import type { ReactNode } from "react";
import type { Vector3Like } from "three";
import type { Item, Package } from "@/lib/visualiserState";
import { PLACEHOLDER, Triple, formatNumber } from "./itemInfoPanel";
import styles from "./itemInfoPanel.module.css";

function volume(size: Vector3Like): number {
    return size.x * size.y * size.z;
}

function totalWeight(items: Item[]): number | null {
    const weights: number[] = items.flatMap(item => item.weight != null ? [item.weight] : []);
    return weights.length ? weights.reduce((sum, weight) => sum + weight, 0) : null;
}

function boxGroups(items: Item[]): string[] {
    return [...new Set(items.flatMap(item => item.boxGroup ? [item.boxGroup] : []))];
}

interface BoxInfoPanelProps {
    box?: Package;
}

export function BoxInfoPanel({ box }: BoxInfoPanelProps) {
    const boxVolume: number | null = box ? volume(box.size) : null;
    const itemVolume: number | null = box ? box.items.reduce((sum, item) => sum + volume(item.size), 0) : null;
    const weight: number | null = box ? totalWeight(box.items) : null;
    const groups: string[] = box ? boxGroups(box.items) : [];

    const rows: [label: string, value: ReactNode][] = [
        ["Reference",           box?.reference ?? PLACEHOLDER],
        ["Size (m)",            box ? <Triple v={box.size} /> : PLACEHOLDER],
        ["Volume (m³)",         boxVolume != null ? formatNumber(boxVolume) : PLACEHOLDER],
        ["Items",               box ? String(box.items.length) : PLACEHOLDER],
        ["Item weight",         weight != null ? formatNumber(weight) : PLACEHOLDER],
        ["Item volume (m³)",    itemVolume != null ? formatNumber(itemVolume) : PLACEHOLDER],
        ["Space used",          boxVolume && itemVolume != null ? `${Number((itemVolume / boxVolume * 100).toFixed(1))}%` : PLACEHOLDER],
        ["Box groups",          groups.length ? groups.join(", ") : PLACEHOLDER],
    ];

    return (
        <table className={styles.infoTable}>
            <tbody>
                {rows.map(([label, value]) => (
                    <tr key={label}>
                        <th scope="row">{label}</th>
                        <td className={styles.idValue}>{value}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}