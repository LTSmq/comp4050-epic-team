import type { Vector3Like } from "three";
import type { Item } from "@/lib/visualiserState";
import styles from "./itemInfoPanel.module.css";
import type { ReactNode } from "react";

export const PLACEHOLDER = "-";

export function formatNumber(value: number): string {
    return Number(value.toFixed(3)).toString();
}

export function Triple({ v }: { v: Vector3Like }) {
    return (
        <span className={styles.triple}>
            <span className={styles.tripleCell}>{formatNumber(v.x)}</span>
            <span className={styles.tripleCell}>{formatNumber(v.y)}</span>
            <span className={styles.tripleCell}>{formatNumber(v.z)}</span>
        </span>
    );
}

interface ItemInfoPanelProps {
    /** The item currently being placed; placeholders are shown when absent. */
    item?: Item;
}

/** Table of the inspected {@link Item}'s details. */
export function ItemInfoPanel({ item }: ItemInfoPanelProps) {
    const rows: [label: string, value: ReactNode][] = [
        ["SKU",             item?.sku != null ? String(item.sku) : PLACEHOLDER],
        ["Reference",       item?.reference ?? PLACEHOLDER],
        ["Box group",       item?.boxGroup ?? PLACEHOLDER],
        ["Weight",          item?.weight != null ? formatNumber(item.weight) : PLACEHOLDER],
        ["Position (m)",    item ? <Triple v = {item.position} /> : PLACEHOLDER],
        ["Size (m)",        item ? <Triple v = {item.size} /> : PLACEHOLDER],
        ["Volume (m³)",     item ? formatNumber(item.size.x * item.size.y * item.size.z) : PLACEHOLDER],
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
