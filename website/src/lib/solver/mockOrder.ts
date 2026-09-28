import type { Order, SolverBoxType } from "./types";

export const mockOrders: Order[] = [
  {
    orderId: "22",
    items: [
      {
        itemCode: "ITM-001",
        itemReference: "Crate A",
        width: 200,
        length: 200,
        depth: 100,
        weight: 3.0,
        boxGroup: null,
        quantity: 2,
      },
      {
        itemCode: "ITM-002",
        itemReference: "Small Box",
        width: 100,
        length: 100,
        depth: 100,
        weight: 1.0,
        boxGroup: null,
        quantity: 1,
      },
    ],
  },
];

export const mockBoxTypes: SolverBoxType[] = [
  {
    Reference: "SML",
    Width: 150,
    Length: 150,
    Depth: 150,
    MaxWeight: 8.5,
    BoxWeight: 0.5,
    Active: true,
    MaximumBoxes: 100,
  },
  {
    Reference: "MED",
    Width: 400,
    Length: 400,
    Depth: 400,
    MaxWeight: 25.0,
    BoxWeight: 0.75,
    Active: true,
    MaximumBoxes: null,
  },
];
