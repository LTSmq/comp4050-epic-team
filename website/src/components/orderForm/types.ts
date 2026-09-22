/**
 * Order Form Data Models & Type Definitions
 *
 * Responsibility:
 * Canonical domain definitions for orders, item dimensions, sources, and UI modes across
 * the order workbench. Shared between `OrderForm.tsx`, sub-components, and `orderUtils.ts`
 */

import type { OrderProgress } from "@/lib/orders/progress";

export type OrderSource = "External" | "Manual" | "Imported";

export type OrderStatus = "Available" | "Draft" | "Imported";

export type { OrderProgress };

export type OrderItem = {
  ItemCode: string;
  ItemReference: string;
  Width: number;
  Length: number;
  Depth: number;
  BoxGroup?: string;
};

export type OrderRecord = {
  orderId: string;
  source: OrderSource;
  status: OrderStatus;
  progress?: OrderProgress;
  items: OrderItem[];
  customerId?: string;
  customerName?: string;
};

export type ApiRecord = Record<string, unknown>;

export type OrderFormProps = {
  username?: string;
  embedded?: boolean;
};

export type ComposerMode = "manual" | "import" | null;

export type SelectedKind = "staged" | "saved" | null;