"use client";

/**
 * OrderInspector Component
 *
 * Responsibility:
 * Right-hand inspector drawer for reviewing and modifying a selected order (staged or saved). Provides:
 * - Empty state watermark when no order is active
 * - Header with order ID and source pill badge
 * - Order metadata summary (item count and status)
 * - Scrollable list of items rendered with `<ItemFields />` for real-time dimension editing
 * - Action footer: "Remove" button (shown only for saved orders) and "Save changes" commit button
 */

import ItemFields from "./ItemFields";
import styles from "./styles/orderInspector.module.css";
import orderRowStyles from "./styles/orderRow.module.css";
import { OrderItem, OrderRecord } from "./types";

type OrderInspectorProps = {
  selectedOrder: OrderRecord | null;
  onItemChange: (index: number, field: keyof OrderItem, value: string) => void;
  onSaveChanges: () => void;
};

export default function OrderInspector({
  selectedOrder,
  onItemChange,
  onSaveChanges,
}: OrderInspectorProps) {
  if (!selectedOrder) {
    return (
      <aside className={styles.inspector}>
        <div className={styles.noSelection}>
          <div className={styles.noSelectionMark}>≡</div>
          <span>ORDER DETAILS</span>
          <h2>Select an order</h2>
          <p>Choose a loaded or saved order to review its information.</p>
        </div>
      </aside>
    );
  }

  const sourceClass =
    selectedOrder.source === "External"
      ? orderRowStyles.externalPill
      : selectedOrder.source === "Manual"
        ? orderRowStyles.manualPill
        : orderRowStyles.importedPill;

  return (
    <aside className={styles.inspector}>
      <div className={styles.inspectorHeader}>
        <div>
          <span>SELECTED ORDER</span>
          <h2>{selectedOrder.orderId}</h2>
        </div>

        <span className={`${orderRowStyles.sourcePill} ${sourceClass}`}>
          {selectedOrder.source}
        </span>
      </div>

      <div className={styles.inspectorMeta}>
        <div>
          <span>ITEMS</span>
          <strong>{selectedOrder.items.length}</strong>
        </div>

        <div>
          <span>STATUS</span>
          <strong>{selectedOrder.status}</strong>
        </div>
      </div>

      <div className={styles.inspectorItems}>
        {selectedOrder.items.length === 0 ? (
          <div className={styles.noItems}>
            No item information is currently available.
          </div>
        ) : (
          selectedOrder.items.map((item, index) => (
            <div
              key={`${item.ItemCode}-${index}`}
              className={styles.inspectorItem}
            >
              <div className={styles.inspectorItemHeader}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.ItemReference}</strong>
                  <small>{item.ItemCode}</small>
                </div>
              </div>

              <ItemFields
                item={item}
                onChange={(field, value) => onItemChange(index, field, value)}
              />
            </div>
          ))
        )}
      </div>

      <div className={styles.inspectorActions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onSaveChanges}
        >
          Save changes
          <span>→</span>
        </button>
      </div>
    </aside>
  );
}
