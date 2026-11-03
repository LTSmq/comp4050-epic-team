import type { VisualiserCarton, packingItem } from "@/components/visualiser-v2/types";
import type { PackingRequest, SolverBoxType, SolverItem } from "./types";

/**
 * The solver's /solve reply, as defined in solver/docs/output_schema.md.
 *
 * Geometry only: every length is whole millimetres, x/y/z are a carton's
 * Width/Length/Depth, and z is vertical. Carton references, item weights and
 * box groups are NOT in the reply; we restore them from the request we sent
 * (see toVisualiserCartons).
 */
export interface SolverDims {
  x: number;
  y: number;
  z: number;
}

export interface SolverPackageItem {
  itemCode: string;
  itemReference: string;
  /** Which unit of this item code, counting from 1. */
  unit: number;
  /** Corner nearest the carton origin. */
  position: SolverDims;
  /** Extent after rotation. */
  size: SolverDims;
}

export interface SolverPackage {
  /** Inside dimensions of the carton. */
  size: SolverDims;
  items: SolverPackageItem[];
}

export type UnpackedReason =
  | "TooLarge"
  | "TooHeavy"
  | "SupplyExhausted"
  | "CartonLimitReached";

export interface SolverUnpackedItem {
  itemCode: string;
  itemReference: string;
  unit: number;
  /** Size as ordered (never rotated). */
  size: SolverDims;
  weight: number;
  reason: UnpackedReason | string;
}

export interface SolverSolution {
  id: string;
  packages: SolverPackage[];
  unpacked: SolverUnpackedItem[];
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export class SolverSolutionParseError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(path ? `Invalid solver solution at ${path}: ${message}` : `Invalid solver solution: ${message}`);
    this.name = "SolverSolutionParseError";
    Object.setPrototypeOf(this, SolverSolutionParseError.prototype);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, path: string): string {
  if (typeof value !== "string") throw new SolverSolutionParseError("expected a string", path);
  return value;
}

function int(value: unknown, path: string, min: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new SolverSolutionParseError(`expected an integer >= ${min}`, path);
  }
  return value;
}

function dims(value: unknown, path: string, min: number): SolverDims {
  if (!isRecord(value)) throw new SolverSolutionParseError("expected {x, y, z}", path);
  return {
    x: int(value.x, `${path}.x`, min),
    y: int(value.y, `${path}.y`, min),
    z: int(value.z, `${path}.z`, min),
  };
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new SolverSolutionParseError("expected an array", path);
  return value;
}

/** Validates an unknown /solve reply. Throws SolverSolutionParseError. */
export function parseSolverSolution(input: unknown): SolverSolution {
  if (!isRecord(input)) throw new SolverSolutionParseError("expected an object");
  if (typeof input.Error === "string") {
    throw new SolverSolutionParseError(`solver returned an error: ${input.Error}`, "Error");
  }

  const packages = list(input.packages, "packages").map((pkg, p) => {
    const path = `packages[${p}]`;
    if (!isRecord(pkg)) throw new SolverSolutionParseError("expected an object", path);
    return {
      size: dims(pkg.size, `${path}.size`, 1),
      items: list(pkg.items, `${path}.items`).map((item, i) => {
        const ip = `${path}.items[${i}]`;
        if (!isRecord(item)) throw new SolverSolutionParseError("expected an object", ip);
        return {
          itemCode: str(item.itemCode, `${ip}.itemCode`),
          itemReference: str(item.itemReference, `${ip}.itemReference`),
          unit: int(item.unit, `${ip}.unit`, 1),
          position: dims(item.position, `${ip}.position`, 0),
          size: dims(item.size, `${ip}.size`, 1),
        };
      }),
    };
  });

  // Always present per the schema; tolerate absence as "nothing unpacked".
  const unpacked = (input.unpacked === undefined ? [] : list(input.unpacked, "unpacked")).map(
    (entry, u) => {
      const up = `unpacked[${u}]`;
      if (!isRecord(entry)) throw new SolverSolutionParseError("expected an object", up);
      const weight = entry.weight;
      if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
        throw new SolverSolutionParseError("expected a non-negative number", `${up}.weight`);
      }
      return {
        itemCode: str(entry.itemCode, `${up}.itemCode`),
        itemReference: str(entry.itemReference, `${up}.itemReference`),
        unit: int(entry.unit, `${up}.unit`, 1),
        size: dims(entry.size, `${up}.size`, 1),
        weight,
        reason: str(entry.reason, `${up}.reason`),
      };
    }
  );

  return { id: str(input.id, "id"), packages, unpacked };
}

/**
 * Account for every physical unit in the exact request. Duplicate item codes
 * share a 1-based counter across all packages and unpacked entries; a unit
 * number does not identify an order line (solver/docs/output_schema.md).
 * Partial solutions pass this check, then must be handled via `unpacked`.
 */
export function validateSolverSolution(
  solution: SolverSolution,
  request: PackingRequest
): void {
  if (solution.id !== request.OrderId) {
    throw new SolverSolutionParseError("order ID does not match the request", "id");
  }

  const expected = new Map<string, number>();
  // Unit numbers do not identify input lines. Match contents as a multiset,
  // allowing both repeated codes and rotated placements in any output order.
  const contentKey = (code: string, reference: string, size: SolverDims) =>
    JSON.stringify([code, reference, sortedDims(size.x, size.y, size.z)]);
  const remainingContents = new Map<string, number>();
  for (const item of request.Items) {
    expected.set(item.ItemCode, (expected.get(item.ItemCode) ?? 0) + 1);
    const key = contentKey(item.ItemCode, item.ItemReference, {
      x: item.Width, y: item.Length, z: item.Depth,
    });
    remainingContents.set(key, (remainingContents.get(key) ?? 0) + 1);
  }

  const seen = new Map<string, Set<number>>();
  const visit = (item: SolverPackageItem | SolverUnpackedItem, path: string) => {
    const count = expected.get(item.itemCode);
    if (count === undefined) {
      throw new SolverSolutionParseError(`unknown item code '${item.itemCode}'`, `${path}.itemCode`);
    }
    if (!Number.isInteger(item.unit) || item.unit < 1 || item.unit > count) {
      throw new SolverSolutionParseError(
        `unknown unit ${item.unit} for '${item.itemCode}' (expected 1 to ${count})`,
        `${path}.unit`
      );
    }
    const units = seen.get(item.itemCode) ?? new Set<number>();
    if (units.has(item.unit)) {
      throw new SolverSolutionParseError(`duplicate unit ${item.unit} for '${item.itemCode}'`, `${path}.unit`);
    }
    const key = contentKey(item.itemCode, item.itemReference, item.size);
    const remaining = remainingContents.get(key) ?? 0;
    if (remaining === 0) {
      throw new SolverSolutionParseError("item reference or size does not match a remaining requested unit", path);
    }
    remainingContents.set(key, remaining - 1);
    units.add(item.unit);
    seen.set(item.itemCode, units);
  };

  solution.packages.forEach((pkg, p) =>
    pkg.items.forEach((item, i) => visit(item, `packages[${p}].items[${i}]`))
  );
  solution.unpacked.forEach((item, u) => visit(item, `unpacked[${u}]`));

  for (const [code, count] of expected) {
    if ((seen.get(code)?.size ?? 0) !== count) {
      throw new SolverSolutionParseError(`missing units for '${code}' (expected ${count})`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Conversion for the visualiser                                       */
/* ------------------------------------------------------------------ */

const sortedDims = (a: number, b: number, c: number) =>
  [a, b, c].sort((p, q) => p - q).join("x");

function findBoxType(size: SolverDims, boxTypes: SolverBoxType[]): SolverBoxType | undefined {
  return boxTypes.find(
    (box) => box.Width === size.x && box.Length === size.y && box.Depth === size.z
  );
}

/**
 * Converts a solution into the cartons the visualiser reads from
 * GET /api/solutions (same shape and units as before solver #26).
 *
 * - mm -> metres (divide by 1000)
 * - solver z is vertical, three.js y is vertical, so y and z swap
 * - carton reference, weight and box group come from `request`, the exact
 *   body we sent to /solve
 */
export function toVisualiserCartons(
  solution: SolverSolution,
  request: PackingRequest
): VisualiserCarton[] {
  const itemsByCode = new Map<string, SolverItem[]>();
  for (const item of request.Items) {
    const group = itemsByCode.get(item.ItemCode) ?? [];
    group.push(item);
    itemsByCode.set(item.ItemCode, group);
  }

  // Placed size is rotated, so match on sorted dimensions. Only matters when
  // two order lines share an item code.
  const findOriginal = (placed: SolverPackageItem): SolverItem | undefined => {
    const candidates = itemsByCode.get(placed.itemCode) ?? [];
    const key = sortedDims(placed.size.x, placed.size.y, placed.size.z);
    return (
      candidates.find(
        (item) =>
          item.ItemReference === placed.itemReference &&
          sortedDims(item.Width, item.Length, item.Depth) === key
      ) ?? candidates[0]
    );
  };

  return solution.packages.map((pkg, boxIndex) => {
    const boxType = findBoxType(pkg.size, request.BoxTypes);

    const items: packingItem[] = pkg.items.map((placed, itemIndex) => {
      const original = findOriginal(placed);
      return {
        uuid: `${boxIndex}-${placed.itemCode}-${itemIndex}`,
        position: {
          x: placed.position.x / 1000,
          y: placed.position.z / 1000,
          z: placed.position.y / 1000,
        },
        size: {
          x: placed.size.x / 1000,
          y: placed.size.z / 1000,
          z: placed.size.y / 1000,
        },
        itemCode: placed.itemCode,
        itemReference: placed.itemReference,
        weight: original?.Weight ?? 0,
        boxGroup: original?.BoxGroup ?? null,
      };
    });

    return {
      boxIndex,
      boxReference: boxType?.Reference ?? `CUSTOM-${pkg.size.x}x${pkg.size.y}x${pkg.size.z}`,
      containerSize: {
        x: pkg.size.x / 1000,
        y: pkg.size.z / 1000,
        z: pkg.size.y / 1000,
      },
      items,
    };
  });
}

/** "ITM-900 (TooLarge), ..." for error messages. */
export function describeUnpacked(unpacked: SolverUnpackedItem[]): string {
  return unpacked.map((entry) => `${entry.itemCode} (${entry.reason})`).join(", ");
}
