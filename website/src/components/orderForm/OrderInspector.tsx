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
import { OrderItem, OrderRecord, SelectedKind } from "./types";
import { progressLabel, type ViewerRole } from "@/lib/orders/progress";

type OrderInspectorProps = {
  selectedOrder: OrderRecord | null;
  selectedKind: SelectedKind;
  canEdit?: boolean;
  canDelete?: boolean;            // NEW
  viewerRole?: ViewerRole;
  onItemChange: (index: number, field: keyof OrderItem, value: string) => void;
  onRemoveSavedOrder: (orderId: string) => void;
  onSaveChanges: () => void;
};

export default function OrderInspector({
  selectedOrder,
  selectedKind,
  canEdit = true,
  canDelete = false,              // NEW, default off
  viewerRole = "customer",
  onItemChange,
  onRemoveSavedOrder,
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
      ? styles.externalPill
      : selectedOrder.source === "Manual"
        ? styles.manualPill
        : styles.importedPill;

  return (
    <aside className={styles.inspector}>
      <div className={styles.inspectorHeader}>
        <div>
          <span>SELECTED ORDER</span>
          <h2>{selectedOrder.orderId}</h2>
        </div>

        <span className={`${styles.sourcePill} ${sourceClass}`}>
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
          <strong>
            {selectedKind === "saved"
              ? progressLabel(selectedOrder.progress, viewerRole)
              : "Not saved"}
          </strong>
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

      {canEdit && (
        <div className={styles.inspectorActions}>
          {selectedKind === "saved" && canDelete && (
            <button
              type="button"
              className={styles.removeOrderButton}
              onClick={() => onRemoveSavedOrder(selectedOrder.orderId)}
            >
              Remove
            </button>
          )}

          <button
            type="button"
            className={styles.primaryButton}
            onClick={onSaveChanges}
          >
            Save changes
            <span>→</span>
          </button>
        </div>
      )}
    </aside>
  );
}
