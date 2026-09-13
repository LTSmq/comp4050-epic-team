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

export default function ItemFields({ item, onChange }: ItemFieldsProps) {
  return (
    <div className={styles.itemGrid}>
      <label className={styles.field}>
        <span>Item code</span>
        <input
          type="text"
          value={item.ItemCode}
          onChange={(event) => onChange("ItemCode", event.target.value)}
          placeholder="ITM-001"
        />
      </label>

      <label className={styles.field}>
        <span>Item reference</span>
        <input
          type="text"
          value={item.ItemReference}
          onChange={(event) => onChange("ItemReference", event.target.value)}
          placeholder="Widget A"
        />
      </label>

      <label className={styles.field}>
        <span>Box group</span>
        <input
          type="text"
          value={item.BoxGroup ?? ""}
          onChange={(event) => onChange("BoxGroup", event.target.value)}
          placeholder="Optional"
        />
      </label>

      <label className={styles.field}>
        <span>Width</span>
        <input
          type="number"
          min="0"
          value={item.Width || ""}
          onChange={(event) => onChange("Width", event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Length</span>
        <input
          type="number"
          min="0"
          value={item.Length || ""}
          onChange={(event) => onChange("Length", event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Depth</span>
        <input
          type="number"
          min="0"
          value={item.Depth || ""}
          onChange={(event) => onChange("Depth", event.target.value)}
        />
      </label>
    </div>
  );
}
