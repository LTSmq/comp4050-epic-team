import type { Vector3Like } from "three";
import type { Item } from "@/lib/visualiserState";
import styles from "./itemInfoPanel.module.css";

const PLACEHOLDER = "-";

function formatNumber(value: number): string {
    return Number(value.toFixed(3)).toString();
}

function formatVector(v: Vector3Like, separator: string): string {
    return [v.x, v.y, v.z].map(formatNumber).join(separator);
}

interface ItemInfoPanelProps {
    /** The item currently being placed; placeholders are shown when absent. */
    item?: Item;
}

/** Table of the inspected {@link Item}'s details. */
export function ItemInfoPanel({ item }: ItemInfoPanelProps) {
    const rows: [label: string, value: string][] = [
        ["SKU",             item?.sku != null ? String(item.sku) : PLACEHOLDER],
        ["Reference",       item?.reference ?? PLACEHOLDER],
        ["Box group",       item?.boxGroup ?? PLACEHOLDER],
        ["Weight",          item?.weight != null ? formatNumber(item.weight) : PLACEHOLDER],
        ["Position (m)",    item ? formatVector(item.position, ", ") : PLACEHOLDER],
        ["Size (m)",        item ? formatVector(item.size, " × ") : PLACEHOLDER],
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
