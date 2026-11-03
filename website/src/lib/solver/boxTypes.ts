import type { SolverBoxType } from "./types";

/**
 * The carton sizes offered to the solver with every order (millimetres, kg).
 * The solver keeps no catalogue of its own, so this list is the source of truth
 * for which cartons an order may be packed into.
 */
export const BOX_TYPES: SolverBoxType[] = [
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
