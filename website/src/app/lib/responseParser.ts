import type {
  SolverPackingResponse,
  SolverPackedBox,
  SolverPlacedItem,
  SolverBoxType,
  SolverItem,
} from "./types";

export * from "./types";

/**
 * Custom error thrown when raw solver response payload fails validation against the PascalCase wire contract
 */
export class SolverResponseParseError extends Error {
  public readonly path?: string;
  public readonly receivedValue?: unknown;

  constructor(message: string, path?: string, receivedValue?: unknown) {
    const formattedMessage = path
      ? `Invalid solver response at ${path}: ${message}`
      : `Invalid solver response: ${message}`;
    super(formattedMessage);
    this.name = "SolverResponseParseError";
    this.path = path;
    this.receivedValue = receivedValue;

    Object.setPrototypeOf(this, SolverResponseParseError.prototype);
  }
}

function formatValue(val: unknown): string {
  if (val === null) return "null";
  if (val === undefined) return "undefined";
  if (typeof val === "string") return JSON.stringify(val);
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return `array (length ${val.length})`;
  if (typeof val === "object") return "object";
  return typeof val;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Enforces that no legacy snake_case or lowercase-prefixed keys exist on the object
 * Strictly targets the new uniformly PascalCase contract
 */
function assertPascalCaseKeys(record: Record<string, unknown>, path?: string): void {
  for (const key of Object.keys(record)) {
    if (key.includes("_") || /^[a-z]/.test(key)) {
      const fieldPath = path ? `${path}.${key}` : key;
      throw new SolverResponseParseError(
        `Detected non-PascalCase key '${key}'. Only the PascalCase solver response contract is supported.`,
        fieldPath,
        record[key]
      );
    }
  }
}

function validateNonNegativeInteger(val: unknown, path: string): number {
  if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
    throw new SolverResponseParseError(
      `Expected non-negative integer, received ${formatValue(val)}`,
      path,
      val
    );
  }
  return val;
}

function validateNullableNonNegativeInteger(val: unknown, path: string): number | null {
  if (val === null || val === undefined) {
    return null;
  }
  return validateNonNegativeInteger(val, path);
}

function validateFiniteNumber(val: unknown, path: string): number {
  if (typeof val !== "number" || !Number.isFinite(val) || val < 0) {
    throw new SolverResponseParseError(
      `Expected finite non-negative number, received ${formatValue(val)}`,
      path,
      val
    );
  }
  return val;
}

function validateNullableFiniteNumber(val: unknown, path: string): number | null {
  if (val === null || val === undefined) {
    return null;
  }
  return validateFiniteNumber(val, path);
}

function validateString(val: unknown, path: string): string {
  if (typeof val !== "string") {
    throw new SolverResponseParseError(
      `Expected string, received ${formatValue(val)}`,
      path,
      val
    );
  }
  return val;
}

function validateNullableString(val: unknown, path: string): string | null {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val !== "string") {
    throw new SolverResponseParseError(
      `Expected string or null, received ${formatValue(val)}`,
      path,
      val
    );
  }
  return val;
}

function validateBoolean(val: unknown, path: string, defaultValue = true): boolean {
  if (val === undefined) {
    return defaultValue;
  }
  if (typeof val !== "boolean") {
    throw new SolverResponseParseError(
      `Expected boolean, received ${formatValue(val)}`,
      path,
      val
    );
  }
  return val;
}

function validateItem(val: unknown, path: string): SolverItem {
  if (!isRecord(val)) {
    throw new SolverResponseParseError(`Expected item object, received ${formatValue(val)}`, path, val);
  }
  assertPascalCaseKeys(val, path);

  const itemCode = validateString(val.ItemCode, `${path}.ItemCode`);
  const itemReference = validateString(val.ItemReference, `${path}.ItemReference`);
  const width = validateNonNegativeInteger(val.Width, `${path}.Width`);
  const length = validateNonNegativeInteger(val.Length, `${path}.Length`);
  const depth = validateNonNegativeInteger(val.Depth, `${path}.Depth`);
  const weight = validateFiniteNumber(val.Weight, `${path}.Weight`);
  const boxGroup = validateNullableString(val.BoxGroup, `${path}.BoxGroup`);

  return {
    ItemCode: itemCode,
    ItemReference: itemReference,
    Width: width,
    Length: length,
    Depth: depth,
    Weight: weight,
    BoxGroup: boxGroup,
  };
}

function validatePlacedItem(val: unknown, path: string): SolverPlacedItem {
  if (!isRecord(val)) {
    throw new SolverResponseParseError(`Expected placed item object, received ${formatValue(val)}`, path, val);
  }
  assertPascalCaseKeys(val, path);

  const item = validateItem(val.Item, `${path}.Item`);
  const x = validateNonNegativeInteger(val.X, `${path}.X`);
  const y = validateNonNegativeInteger(val.Y, `${path}.Y`);
  const z = validateNonNegativeInteger(val.Z, `${path}.Z`);
  const width = validateNonNegativeInteger(val.Width, `${path}.Width`);
  const length = validateNonNegativeInteger(val.Length, `${path}.Length`);
  const depth = validateNonNegativeInteger(val.Depth, `${path}.Depth`);

  return {
    Item: item,
    X: x,
    Y: y,
    Z: z,
    Width: width,
    Length: length,
    Depth: depth,
  };
}

function validateBoxType(val: unknown, path: string): SolverBoxType {
  if (!isRecord(val)) {
    throw new SolverResponseParseError(`Expected box type object, received ${formatValue(val)}`, path, val);
  }
  assertPascalCaseKeys(val, path);

  const reference = validateString(val.Reference, `${path}.Reference`);
  const width = validateNonNegativeInteger(val.Width, `${path}.Width`);
  const length = validateNonNegativeInteger(val.Length, `${path}.Length`);
  const depth = validateNonNegativeInteger(val.Depth, `${path}.Depth`);
  const maxWeight = validateNullableFiniteNumber(val.MaxWeight, `${path}.MaxWeight`);
  const boxWeight = validateNullableFiniteNumber(val.BoxWeight, `${path}.BoxWeight`);
  const active = validateBoolean(val.Active, `${path}.Active`, true);
  const maximumBoxes = validateNullableNonNegativeInteger(val.MaximumBoxes, `${path}.MaximumBoxes`);

  return {
    Reference: reference,
    Width: width,
    Length: length,
    Depth: depth,
    MaxWeight: maxWeight,
    BoxWeight: boxWeight,
    Active: active,
    MaximumBoxes: maximumBoxes,
  };
}

function validatePackedBox(val: unknown, path: string): SolverPackedBox {
  if (!isRecord(val)) {
    throw new SolverResponseParseError(`Expected packed box object, received ${formatValue(val)}`, path, val);
  }
  assertPascalCaseKeys(val, path);

  const boxIndex = validateNonNegativeInteger(val.BoxIndex, `${path}.BoxIndex`);
  const boxType = validateBoxType(val.BoxType, `${path}.BoxType`);

  if (!("PlacedItems" in val)) {
    throw new SolverResponseParseError("Missing required property 'PlacedItems'", path);
  }
  if (!Array.isArray(val.PlacedItems)) {
    throw new SolverResponseParseError(
      `Property 'PlacedItems' must be an array, received ${formatValue(val.PlacedItems)}`,
      `${path}.PlacedItems`,
      val.PlacedItems
    );
  }

  const placedItems = val.PlacedItems.map((item, index) =>
    validatePlacedItem(item, `${path}.PlacedItems[${index}]`)
  );

  return {
    BoxIndex: boxIndex,
    BoxType: boxType,
    PlacedItems: placedItems,
  };
}

/**
 * Validates and parses raw solver response input
 * Accepts unknown input (e.g. JSON string or parsed object from fetch response.json())
 * Strictly enforces PascalCase contract matching solver/optimisation-engine
 *
 * @throws {SolverResponseParseError} If payload does not match contract or contains legacy snake_case keys
 */
export function parseSolverResponse(input: unknown): SolverPackingResponse {
  let payload: unknown = input;

  if (typeof input === "string") {
    try {
      payload = JSON.parse(input);
    } catch (error) {
      throw new SolverResponseParseError(
        `Failed to parse JSON string: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (!isRecord(payload)) {
    throw new SolverResponseParseError(`Expected response object, received ${formatValue(payload)}`);
  }

  assertPascalCaseKeys(payload);

  if (typeof payload.Error === "string") {
    throw new SolverResponseParseError(`Solver returned error: "${payload.Error}"`, "Error", payload.Error);
  }

  if (!("PackedBoxes" in payload)) {
    throw new SolverResponseParseError("Missing required property 'PackedBoxes'");
  }

  if (!Array.isArray(payload.PackedBoxes)) {
    throw new SolverResponseParseError(
      `Property 'PackedBoxes' must be an array, received ${formatValue(payload.PackedBoxes)}`,
      "PackedBoxes",
      payload.PackedBoxes
    );
  }

  const packedBoxes = payload.PackedBoxes.map((box, index) =>
    validatePackedBox(box, `PackedBoxes[${index}]`)
  );

  return {
    PackedBoxes: packedBoxes,
  };
}

/**
 * Alias for parseSolverResponse
 */
export const parsePackingResponse = parseSolverResponse;

/**
 * Type guard for checking if an unknown value satisfies the SolverPackingResponse contract
 */
export function isSolverResponse(input: unknown): input is SolverPackingResponse {
  try {
    parseSolverResponse(input);
    return true;
  } catch {
    return false;
  }
}
