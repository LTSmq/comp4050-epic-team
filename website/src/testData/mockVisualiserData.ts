import { convertSolverResponseToVisualiser } from "../app/lib/responseParser";
import type { SolverPackingResponse } from "../app/lib/types";
import type { VisualiserCarton } from "../components/visualiser/types";
import sampleJson from "./sampleResponse.json";

/**
 * Raw solver response for 1 order with 1 carton and 4 packed items:
 * - 400x400x400 mm carton (MED-BOX-01)
 * - 3 items placed on the carton floor
 * - 1 item stacked vertically on top of Item 1
 */
export const mockRawSolverResponse: SolverPackingResponse = sampleJson as SolverPackingResponse;

/**
 * Converted visualiser-ready cartons (dimensions converted to metres, axes converted to Three.js Y-up).
 */
export const mockVisualiserCartons: VisualiserCarton[] = convertSolverResponseToVisualiser(mockRawSolverResponse);

/**
 * Single carton solution ready to be plugged directly into <VisualiserWorkspace solution={...} />
 */
export const mockSingleCartonSolution: VisualiserCarton = mockVisualiserCartons[0];
