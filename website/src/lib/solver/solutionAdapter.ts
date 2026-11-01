import type {
  SolverPackingResponse,
  SolverPackedBox,
  SolverBoxType,
  SolverItem,
} from "@/app/lib/types";
import type { PackingRequest } from "./types";

/**
 * Adapts the solver's reply to the PascalCase PackingResponse the portal stores.
 *
 * Since solver PR #26 the /solve reply is the visualiser-shaped
 * { id, packages, unpacked } (see solver/docs/output_schema.md). That shape
 * carries geometry only: no carton reference, item weight or box group.
 * We still have all of those in the request we sent, so we restore them here and
 * hand the rest of the portal the old shape. responseParser, solutionStore and
 * the visualiser cartons then keep working without changes.
 *
 * A reply that is already in the old PackedBoxes shape is returned as-is.
 */

interface Dim {
  x: number;
  y: number;
  z: number;
}

interface NewPackageItem {
  itemCode: string;
  itemReference: string;
  unit: number;
  position: Dim;
  size: Dim;
}

interface NewUnpackedEntry {
  itemCode: string;
  itemReference: string;
  unit: number;
  size: Dim;
  weight: number;
  reason: string;
}

interface NewSolverSolution {
  id: string;
  packages: { size: Dim; items: NewPackageItem[] }[];
  unpacked: NewUnpackedEntry[];
}

export interface AdaptedSolverResult {
  response: SolverPackingResponse;
  unpacked: { itemCode: string; reason?: string }[];
}

function isNewShape(value: unknown): value is NewSolverSolution {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).packages)
  );
}

function findBoxType(size: Dim, boxTypes: SolverBoxType[]): SolverBoxType {
  // A package's size is its carton's Width (x), Length (y) and Depth (z).
  const match = boxTypes.find(
    (box) =>
      box.Width === size.x && box.Length === size.y && box.Depth === size.z
  );

  return (
    match ?? {
      Reference: `CUSTOM-${size.x}x${size.y}x${size.z}`,
      Width: size.x,
      Length: size.y,
      Depth: size.z,
      MaxWeight: null,
      BoxWeight: null,
      Active: true,
      MaximumBoxes: null,
    }
  );
}

export function adaptSolverResult(
  raw: unknown,
  request: PackingRequest
): AdaptedSolverResult {
  // Old contract: pass through untouched.
  if (!isNewShape(raw)) {
    const old = (raw ?? {}) as Record<string, unknown>;
    const unpacked = Array.isArray(old.UnpackedItems)
      ? (old.UnpackedItems as { ItemCode?: string }[]).map((item) => ({
          itemCode: item.ItemCode ?? "?",
        }))
      : [];
    return { response: raw as SolverPackingResponse, unpacked };
  }

  const itemsByCode = new Map<string, SolverItem[]>();
  for (const item of request.Items) {
    const list = itemsByCode.get(item.ItemCode) ?? [];
    list.push(item);
    itemsByCode.set(item.ItemCode, list);
  }

  // Placed size is rotated, so compare sorted dimensions. Normally one
  // candidate per code; this only matters if two order lines share a code.
  const sortedDims = (a: number, b: number, c: number) =>
    [a, b, c].sort((p, q) => p - q).join("x");

  const findOriginal = (placed: NewPackageItem): SolverItem | undefined => {
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

  const packedBoxes: SolverPackedBox[] = raw.packages.map((pkg, boxIndex) => ({
    BoxIndex: boxIndex,
    BoxType: findBoxType(pkg.size, request.BoxTypes),
    PlacedItems: pkg.items.map((placed) => {
      const original = findOriginal(placed);
      return {
        Item: {
          ItemCode: placed.itemCode,
          ItemReference: placed.itemReference,
          // Original (unrotated) dimensions, weight and group come from our request.
          Width: original?.Width ?? placed.size.x,
          Length: original?.Length ?? placed.size.y,
          Depth: original?.Depth ?? placed.size.z,
          Weight: original?.Weight ?? 0,
          BoxGroup: original?.BoxGroup ?? null,
        },
        X: placed.position.x,
        Y: placed.position.y,
        Z: placed.position.z,
        // Placed size is after rotation, which is what the visualiser draws.
        Width: placed.size.x,
        Length: placed.size.y,
        Depth: placed.size.z,
      };
    }),
  }));

  return {
    response: { OrderId: raw.id, PackedBoxes: packedBoxes },
    unpacked: (raw.unpacked ?? []).map((entry) => ({
      itemCode: entry.itemCode,
      reason: entry.reason,
    })),
  };
}
