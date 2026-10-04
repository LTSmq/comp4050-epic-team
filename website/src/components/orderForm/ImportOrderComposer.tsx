"use client";

/**
 * ImportOrderComposer Component
 *
 * Responsibility:
 * Form section for importing order files. Provides:
 * - Fallback Order ID input (used if an uploaded JSON/CSV lacks an explicit OrderID column/key)
 * - File picker dropzone accepting `.json` and `.csv` files
 * - Displays selected filename feedback and dismiss close button
 */

import { ChangeEvent } from "react";
import styles from "./styles/importOrder.module.css";

type ImportOrderComposerProps = {
  importOrderId: string;
  onOrderIdChange: (id: string) => void;
  importFileName: string;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
};

export default function ImportOrderComposer({
  importOrderId,
  onOrderIdChange,
  importFileName,
  onFileSelect,
  onClose,
}: ImportOrderComposerProps) {
  return (
    <section className={styles.composer}>
      <div className={styles.composerHeader}>
        <div>
          <span>FILE IMPORT</span>
          <h2>Import orders</h2>
          <p>Select a CSV or JSON order file.</p>
        </div>

        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <label className={styles.orderIdField}>
        <span>Order ID (optional)</span>
        <input
          type="text"
          value={importOrderId}
          onChange={(event) => onOrderIdChange(event.target.value)}
          placeholder="Only needed if the file does not contain an Order ID"
        />
      </label>

      <label className={styles.dropZone}>
        <input
          type="file"
          accept=".json,.csv,application/json,text/csv"
          onChange={onFileSelect}
        />
        <div className={styles.uploadMark}>↑</div>
        <strong>Select order file</strong>
        <span>CSV or JSON</span>
        {importFileName && <small>{importFileName}</small>}
      </label>
    </section>
  );
}
