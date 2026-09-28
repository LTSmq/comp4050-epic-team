/**
 * TypeScript wire types matching the latest solver/optimisation-engine contract
 */

export interface SolverItem {
  ItemCode: string;
  ItemReference: string;
  Width: number;
  Length: number;
  Depth: number;
  Weight: number;
  BoxGroup: string | null;
}

export interface SolverBoxType {
  Reference: string;
  Width: number;
  Length: number;
  Depth: number;
  MaxWeight: number | null;
  BoxWeight: number | null;
  Active: boolean;
  MaximumBoxes: number | null;
}

export interface SolverPlacedItem {
  Item: SolverItem;
  X: number;
  Y: number;
  Z: number;
  Width: number;
  Length: number;
  Depth: number;
}

export interface SolverPackedBox {
  BoxIndex: number;
  BoxType: SolverBoxType;
  PlacedItems: SolverPlacedItem[];
}

export interface SolverPackingResponse {
  OrderId?: string;
  PackedBoxes: SolverPackedBox[];
}

export interface SolverErrorResponse {
  Error: string;
}

export type {
  VisualiserCarton,
  packingItem,
  packingSolution,
  vector3Data,
} from "../../components/visualiser/types";
