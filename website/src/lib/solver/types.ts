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

export interface PackingRequest {
  Items: SolverItem[];
  BoxTypes: SolverBoxType[];
}
