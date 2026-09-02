import type { fragility, productInfo } from "./types";
import styles from "./itemInfoPanel.module.css";

interface itemInfoPanelProps {
  product?: productInfo;
}

const fragilityLabels: Record<fragility, string> = {
  standard: "Standard",
  fragile: "Fragile",
  "very-fragile": "Very Fragile",
};

/* Renders a product info table for the currently active packing item */
export function ItemInfoPanel({ product }: itemInfoPanelProps) {
  if (!product) return null;

  return (
    <aside className={styles.panelWrapper} aria-label="Active item information">
      <table className={styles.infoTable}>
        <tbody>
          <tr>
            <th>Name</th>
            <td>{product.name}</td>
          </tr>
          <tr>
            <th>SKU</th>
            <td>{product.sku}</td>
          </tr>
          <tr>
            <th>Weight</th>
            <td>{product.weightKg} kg</td>
          </tr>
          <tr>
            <th>Fragility</th>
            <td>{fragilityLabels[product.fragility]}</td>
          </tr>
        </tbody>
      </table>
    </aside>
  );
}

export default ItemInfoPanel;