"use client";

/**
 * OrderRow Component
 *
 * Responsibility:
 * Renders an interactive order card row in either the Staged Orders queue or Saved Orders queue
 * Displays order ID, source pill badge (`External` | `Manual` | `Imported`), item count, status, and chevron
 */

import styles from "./styles/orderRow.module.css";
import { OrderRecord } from "./types";
import { progressLabel, type ViewerRole } from "@/lib/orders/progress";

type OrderRowProps = {
  order: OrderRecord;
  isActive?: boolean;
  statusLabel?: string;
  showCustomer?: boolean;
  viewerRole?: ViewerRole;
  onClick: () => void;
};

export default function OrderRow({
  order,
  isActive = false,
  statusLabel,
  showCustomer = false,
  viewerRole = "customer",
  onClick,
}: OrderRowProps) {
  const sourceClass =
    order.source === "External"
      ? styles.externalPill
      : order.source === "Manual"
        ? styles.manualPill
        : styles.importedPill;

  return (
    <button
      type="button"
      className={`${styles.orderRow} ${isActive ? styles.orderRowActive : ""}`}
      onClick={onClick}
    >
      <div className={styles.orderIdentity}>
        <span className={styles.orderMarker} />
        <strong>{order.orderId}</strong>
        {showCustomer && order.customerName && (
          <small className={styles.customerName}>{order.customerName}</small>
        )}
      </div>

      <span className={`${styles.sourcePill} ${sourceClass}`}>
        {order.source}
      </span>

      <span className={styles.itemCount}>{order.items.length}</span>

      <span className={styles.statusText}>
        <i />
        {statusLabel ?? progressLabel(order.progress, viewerRole)}
      </span>

      <span className={styles.openArrow}>→</span>
    </button>
  );
}