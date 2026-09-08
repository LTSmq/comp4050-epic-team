/**
 * TypeScript wire types matching the latest solver/optimisation-engine contract
 *
 * The raw solver response is uniformly PascalCase throughout:
 * - PackedBoxes: array of packed boxes
 * - BoxIndex, BoxType, PlacedItems
 * - Item, X, Y, Z, Width, Length, Depth
 * - Nested item and box fields: ItemCode, ItemReference, Reference, MaxWeight, BoxWeight, Active, MaximumBoxes, BoxGroup
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

export type SolverItemWire = SolverItem;
export type Item = SolverItem;

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

export type SolverBoxTypeWire = SolverBoxType;
export type BoxType = SolverBoxType;

export interface SolverPlacedItem {
  Item: SolverItem;
  X: number;
  Y: number;
  Z: number;
  Width: number;
  Length: number;
  Depth: number;
}

export type SolverPlacedItemWire = SolverPlacedItem;
export type PlacedItem = SolverPlacedItem;

export interface SolverPackedBox {
  BoxIndex: number;
  BoxType: SolverBoxType;
  PlacedItems: SolverPlacedItem[];
}

export type SolverPackedBoxWire = SolverPackedBox;
export type PackedBox = SolverPackedBox;

export interface SolverPackingResponse {
  PackedBoxes: SolverPackedBox[];
}

export type SolverPackingResponseWire = SolverPackingResponse;
export type PackingResponse = SolverPackingResponse;
export type SolverResponse = SolverPackingResponse;

export interface SolverErrorResponse {
  Error: string;
}

export type ErrorResponse = SolverErrorResponse;

// Request wire and domain types
export interface OrderItem {
  itemCode: string;
  itemReference: string;
  width: number;
  length: number;
  depth: number;
  weight: number;
  boxGroup?: string | null;
  quantity?: number;
}

export interface Order {
  orderId: string;
  items: OrderItem[];
}

export interface PackingRequest {
  Items: SolverItem[];
  BoxTypes: SolverBoxType[];
}

export type {
  VisualiserCarton,
  packingItem,
  packingSolution,
  vector3Data,
} from "../../components/visualiser/types";

