"use client";

/**
 * ItemFields Component
 *
 * Responsibility:
 * Pure presentation input grid for an individual order item's parameters:
 * - Identifiers: `ItemCode`, `ItemReference`, optional `BoxGroup`
 * - 3D Dimensions: `Width`, `Length`, `Depth` (in mm/units)
 * Used by both `<ManualOrderComposer />` (new orders) and `<OrderInspector />` (editing existing items)
 */

import styles from "./styles/itemFields.module.css";
import { OrderItem } from "./types";

export type ItemFieldsProps = {
  item: OrderItem;
  onChange: (field: keyof OrderItem, value: string) => void;
};

const FIELDS: Array<{
  key: keyof OrderItem;
  label: string;
  type: "text" | "number";
  placeholder?: string;
}> = [
  { key: "ItemCode", label: "Item code", type: "text", placeholder: "ITM-001" },
  { key: "ItemReference", label: "Item reference", type: "text", placeholder: "Widget A" },
  { key: "BoxGroup", label: "Box group", type: "text", placeholder: "Optional" },
  { key: "Width", label: "Width", type: "number" },
  { key: "Length", label: "Length", type: "number" },
  { key: "Depth", label: "Depth", type: "number" },
];

export default function ItemFields({ item, onChange }: ItemFieldsProps) {
  return (
    <div className={styles.itemGrid}>
      {FIELDS.map(({ key, label, type, placeholder }) => (
        <label key={key} className={styles.field}>
          <span>{label}</span>
          <input
            type={type}
            {...(type === "number" ? { min: "0" } : {})}
            value={type === "number" ? item[key] || "" : (item[key] ?? "")}
            onChange={(event) => onChange(key, event.target.value)}
            {...(placeholder ? { placeholder } : {})}
          />
        </label>
      ))}
    </div>
  );
}
