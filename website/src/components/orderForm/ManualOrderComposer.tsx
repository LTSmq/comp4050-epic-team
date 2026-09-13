"use client";

/**
 * ManualOrderComposer Component
 *
 * Responsibility:
 * Form section for building and staging a custom manual order from scratch. Manages:
 * - Order ID text input field
 * - Dynamic item list rendering with `<ItemFields />` for each item
 * - Add item (`+ Add item`) and remove item buttons
 * - Submit action ("Add to orders") and dismiss close button
 */

import ItemFields from "./ItemFields";
import styles from "./styles/manualOrder.module.css";
import { OrderItem } from "./types";

type ManualOrderComposerProps = {
  manualOrderId: string;
  onOrderIdChange: (id: string) => void;
  manualItems: OrderItem[];
  onItemChange: (index: number, field: keyof OrderItem, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export default function ManualOrderComposer({
  manualOrderId,
  onOrderIdChange,
  manualItems,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSubmit,
  onClose,
}: ManualOrderComposerProps) {
  return (
    <section className={`${styles.composer} ${styles.manualComposer}`}>
      <div className={styles.manualComposerTop}>
        <div className={styles.manualHero}>
          <div className={styles.manualHeroBadge}>
            <span className={styles.manualHeroDot} />
            ORDER BUILDER
          </div>

          <h2>Create an order</h2>

          <p>
            Add an order ID, enter the item details and add the order to your
            queue.
          </p>
        </div>

        <div className={styles.manualAside}>
          <div className={styles.manualAsideCard}>
            <span>WORKFLOW</span>
            <strong>Create → Save → Review</strong>
            <small>Created orders are saved to your workspace.</small>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.manualBody}>
        <div className={styles.orderIdPanel}>
          <div className={styles.orderIdPanelHeader}>
            <span>ORDER DETAILS</span>
            <strong>Primary information</strong>
          </div>

          <label className={styles.orderIdField}>
            <span>Order ID</span>
            <input
              type="text"
              value={manualOrderId}
              onChange={(event) => onOrderIdChange(event.target.value)}
              placeholder="e.g. ORD-0022"
            />
          </label>
        </div>

        <div className={styles.manualItemsPanel}>
          <div className={styles.itemSectionHeader}>
            <div>
              <span>ITEMS</span>
              <h3>Order contents</h3>
            </div>

            <button
              type="button"
              className={styles.smallButton}
              onClick={onAddItem}
            >
              + Add item
            </button>
          </div>

          <div className={styles.itemStack}>
            {manualItems.map((item, index) => (
              <div key={index} className={styles.itemEditor}>
                <div className={styles.itemEditorHeader}>
                  <div>
                    <span>ITEM {String(index + 1).padStart(2, "0")}</span>
                    <strong>Item {index + 1}</strong>
                  </div>

                  <div className={styles.itemEditorActions}>
                    <span className={styles.itemMiniBadge}>Active</span>

                    {manualItems.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => onRemoveItem(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <ItemFields
                  item={item}
                  onChange={(field, value) => onItemChange(index, field, value)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.composerActions}>
        <div className={styles.manualFooterNote}>
          <span>READY TO ADD</span>
          <p>This order will be saved to your order queue.</p>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={onSubmit}
        >
          Add to orders
          <span>→</span>
        </button>
      </div>
    </section>
  );
}
