"use client"

import { ChevronLeft, ChevronRight} from "lucide-react";
import type { packingItem, vector3Data } from "./types";
import styles from "./itemInfoPanel.module.css";

const placeholder = "-";

function formatNumber(value: number): string{
    return Number(value.toFixed(3)).toString();
}

function Triple ({ v }: { v: vector3Data}) {
    return (
        <span className = {styles.triple}>
            <span className = {styles.tripleCell}>{formatNumber(v.x)}</span>
            <span className = {styles.tripleCell}>{formatNumber(v.y)}</span>
            <span className = {styles.tripleCell}>{formatNumber(v.z)}</span>
        </span>
    )
}

interface itemInfoPanelProps {
    item?: packingItem;
}

export function ItemInfoPanel({ item }: itemInfoPanelProps) {
    const id = item?.uuid ?? placeholder;
    const volume = item
        ? formatNumber(item.size.x * item.size.y * item.size.z)
        : placeholder;

    return(
        <table className = {styles.infoTable}>
            <tbody>
                <tr>
                    <th scope = "row">ID</th>
                    <td className = {styles.idValue}>{id}</td>
                </tr>
                <tr>
                    <th scope = "row">Position</th>
                    <td>{item ? <Triple v = {item.position} /> : placeholder}</td>
                </tr>
                <tr>
                    <th scope = "row">Size</th>
                    <td>{item ? <Triple v = {item.size} /> : placeholder}</td>
                </tr>
                <tr>
                    <th scope = "row">Volume</th>
                    <td>{volume}</td>
                </tr>
            </tbody>
        </table>
    );
}

interface itemInfoRailProps{
    current: number;
    total: number;
}

export function ItemInfoRail({ current, total }: itemInfoRailProps) {
    return (
        <div className = {styles.rail}>
            <span className = {styles.railCounter}>
                {current}/{total}
            </span>
        </div>
    );
}

interface itemNavProps{
    current: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
}

export function ItemNav({ current, total, onPrev, onNext }: itemNavProps) {
    const empty = total === 0;

    return(
        <div className = {styles.nav}>
            <button
                type = "button"
                className = {styles.navButton}
                onClick = {onPrev}
                disabled = {empty || current <= 1}
                aria-label ="Previous Item"
            >
                <ChevronLeft size = {16} strokeWidth = {1.8} aria-hidden = "true" />
            </button>
            <span className = {styles.navCounter}>
                #: {current}/{total}
            </span>
            <button
                type = "button"
                className = {styles.navButton}
                onClick = {onNext}
                disabled = {empty || current >= total}
                aria-label ="Next Item"
            >
                <ChevronRight size = {16} strokeWidth = {1.8} aria-hidden = "true" />
            </button>
        </div>
    );
}

export default ItemInfoPanel;