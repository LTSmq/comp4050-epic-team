import type {
  SolverBoxType,
  SolverItem,
  SolverPackedBox,
  SolverPackingResponse,
} from "@/app/lib/types";

type Dimensions = {
  x: number;
  y: number;
  z: number;
};

type RustPackageItem = {
  itemCode: string;
  itemReference: string;
  unit: number;
  position: Dimensions;
  size: Dimensions;
};

type RustPackage = {
  size: Dimensions;
  items: RustPackageItem[];
};

type RustUnpackedItem = {
  itemCode: string;
  itemReference: string;
  unit: number;
  reason: string;
};

type RustSolution = {
  id: string;
  packages: RustPackage[];
  unpacked: RustUnpackedItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDimensions(value: unknown, path: string): Dimensions {
  if (!isRecord(value)) {
    throw new Error(`Invalid solver response: ${path} must be an object`);
  }

  const { x, y, z } = value;

  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(z) ||
    (x as number) < 0 ||
    (y as number) < 0 ||
    (z as number) < 0
  ) {
    throw new Error(`Invalid solver response dimensions at ${path}`);
  }

  return { x: x as number, y: y as number, z: z as number };
}

function parseRustSolution(value: unknown): RustSolution {
  if (!isRecord(value)) {
    throw new Error("Invalid solver response: expected an object");
  }

  if (
    typeof value.id !== "string" ||
    !Array.isArray(value.packages) ||
    !Array.isArray(value.unpacked)
  ) {
    throw new Error("Invalid solver response structure");
  }

  const packages: RustPackage[] = value.packages.map((entry, index) => {
    if (!isRecord(entry) || !Array.isArray(entry.items)) {
      throw new Error(`Invalid solver package at index ${index}`);
    }

    return {
      size: readDimensions(entry.size, `packages[${index}].size`),
      items: entry.items.map((item: unknown, itemIndex: number) => {
        if (
          !isRecord(item) ||
          typeof item.itemCode !== "string" ||
          typeof item.itemReference !== "string" ||
          !Number.isSafeInteger(item.unit) ||
          (item.unit as number) < 1
        ) {
          throw new Error(
            `Invalid solver item at packages[${index}].items[${itemIndex}]`
          );
        }

        return {
          itemCode: item.itemCode,
          itemReference: item.itemReference,
          unit: item.unit as number,
          position: readDimensions(item.position, "item.position"),
          size: readDimensions(item.size, "item.size"),
        };
      }),
    };
  });

  const unpacked: RustUnpackedItem[] = value.unpacked.map(
    (item: unknown, index: number) => {
      if (
        !isRecord(item) ||
        typeof item.itemCode !== "string" ||
        typeof item.itemReference !== "string" ||
        !Number.isSafeInteger(item.unit) ||
        (item.unit as number) < 1 ||
        typeof item.reason !== "string"
      ) {
        throw new Error(`Invalid unpacked item at index ${index}`);
      }

      return {
        itemCode: item.itemCode,
        itemReference: item.itemReference,
        unit: item.unit as number,
        reason: item.reason,
      };
    }
  );

  return { id: value.id, packages, unpacked };
}

export function adaptSolverResponse(
  response: unknown,
  orderId: string,
  requestedItems: SolverItem[],
  boxTypes: SolverBoxType[]
): SolverPackingResponse {
  const solution = parseRustSolution(response);

  if (solution.id !== orderId) {
    throw new Error(
      `Solver returned order ID ${solution.id}, expected ${orderId}`
    );
  }

  if (solution.unpacked.length > 0) {
    throw new Error(
      `Solver could not pack: ${solution.unpacked
        .map((item) => `${item.itemCode} (${item.reason})`)
        .join(", ")}`
    );
  }

  const packedBoxes: SolverPackedBox[] = solution.packages.map(
    (pkg, boxIndex) => {
      const matchingBoxTypes = boxTypes.filter(
        (box) =>
          box.Active &&
          box.Width === pkg.size.x &&
          box.Length === pkg.size.y &&
          box.Depth === pkg.size.z
      );

      if (matchingBoxTypes.length !== 1) {
        throw new Error(
          `Cannot uniquely identify carton type for package ${boxIndex}`
        );
      }

      const boxType = matchingBoxTypes[0];

      const placedItems = pkg.items.map((item) => {
        const matchingItems = requestedItems.filter(
          (requested) =>
            requested.ItemCode === item.itemCode &&
            requested.ItemReference === item.itemReference
        );

        if (matchingItems.length !== 1) {
          throw new Error(
            `Cannot uniquely identify item ${item.itemCode}`
          );
        }

        const original = matchingItems[0];

        return {
          Item: original,
          X: item.position.x,
          Y: item.position.y,
          Z: item.position.z,
          Width: item.size.x,
          Length: item.size.y,
          Depth: item.size.z,
        };
      });

      return {
        BoxIndex: boxIndex,
        BoxType: boxType,
        PlacedItems: placedItems,
      };
    }
  );

  return {
    OrderId: orderId,
    PackedBoxes: packedBoxes,
  };
}
