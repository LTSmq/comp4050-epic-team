import { describe, expect, it } from "vitest";
import {
  SolverSolutionParseError,
  describeUnpacked,
  parseSolverSolution,
  toVisualiserCartons,
  type SolverSolution,
} from "./solution";
import type { PackingRequest } from "./types";

const request: PackingRequest = {
  OrderId: "PF-000123",
  Items: [
    { ItemCode: "W-1", ItemReference: "Widget", Width: 300, Length: 150, Depth: 75, Weight: 1.2, BoxGroup: "A" },
    { ItemCode: "G", ItemReference: "Glass", Width: 80, Length: 80, Depth: 120, Weight: 0.4, BoxGroup: null },
    { ItemCode: "G", ItemReference: "Lid", Width: 60, Length: 60, Depth: 10, Weight: 0.1, BoxGroup: null },
  ],
  BoxTypes: [
    { Reference: "SML", Width: 150, Length: 150, Depth: 150, MaxWeight: 8.5, BoxWeight: 0.5, Active: true, MaximumBoxes: 100 },
    { Reference: "MED", Width: 400, Length: 400, Depth: 400, MaxWeight: 25, BoxWeight: 0.75, Active: true, MaximumBoxes: null },
  ],
};

// Shape documented in solver/docs/output_schema.md
const reply: SolverSolution = {
  id: "PF-000123",
  packages: [
    {
      size: { x: 400, y: 400, z: 400 },
      items: [{ itemCode: "W-1", itemReference: "Widget", unit: 1, position: { x: 0, y: 0, z: 0 }, size: { x: 75, y: 150, z: 300 } }],
    },
    {
      size: { x: 150, y: 150, z: 150 },
      items: [
        { itemCode: "G", itemReference: "Glass", unit: 1, position: { x: 0, y: 0, z: 0 }, size: { x: 80, y: 80, z: 120 } },
        { itemCode: "G", itemReference: "Lid", unit: 2, position: { x: 80, y: 0, z: 0 }, size: { x: 10, y: 60, z: 60 } },
      ],
    },
  ],
  unpacked: [],
};

describe("parseSolverSolution", () => {
  it("accepts a valid reply", () => {
    expect(parseSolverSolution(JSON.parse(JSON.stringify(reply)))).toEqual(reply);
  });

  it("treats a missing unpacked list as empty", () => {
    expect(parseSolverSolution({ id: "x", packages: [] }).unpacked).toEqual([]);
  });

  it("parses unpacked items with their reason", () => {
    const parsed = parseSolverSolution({
      id: "x",
      packages: [],
      unpacked: [{ itemCode: "BIG", itemReference: "Cabinet", unit: 1, size: { x: 900, y: 600, z: 1800 }, weight: 45, reason: "TooLarge" }],
    });
    expect(parsed.unpacked[0]).toMatchObject({ itemCode: "BIG", reason: "TooLarge", weight: 45 });
  });

  const bad: Array<[string, unknown, string]> = [
    ["a non-object", "nope", "expected an object"],
    ["a solver error", { Error: "The order could not be read" }, "solver returned an error"],
    ["the old PascalCase format", { OrderId: "1", PackedBoxes: [] }, "packages"],
    ["a missing id", { packages: [] }, "Invalid solver solution at id"],
    ["a zero-size carton", { id: "1", packages: [{ size: { x: 0, y: 1, z: 1 }, items: [] }] }, "packages[0].size.x"],
    [
      "a negative position",
      { id: "1", packages: [{ size: { x: 1, y: 1, z: 1 }, items: [{ itemCode: "A", itemReference: "r", unit: 1, position: { x: -1, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } }] }] },
      "packages[0].items[0].position.x",
    ],
    [
      "a fractional size",
      { id: "1", packages: [{ size: { x: 1.5, y: 1, z: 1 }, items: [] }] },
      "packages[0].size.x",
    ],
    [
      "a unit of 0",
      { id: "1", packages: [{ size: { x: 1, y: 1, z: 1 }, items: [{ itemCode: "A", itemReference: "r", unit: 0, position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } }] }] },
      "unit",
    ],
    [
      "a negative unpacked weight",
      { id: "1", packages: [], unpacked: [{ itemCode: "A", itemReference: "r", unit: 1, size: { x: 1, y: 1, z: 1 }, weight: -1, reason: "TooHeavy" }] },
      "unpacked[0].weight",
    ],
  ];
  for (const [label, input, message] of bad) {
    it(`rejects ${label}`, () => {
      expect(() => parseSolverSolution(input)).toThrow(SolverSolutionParseError);
      expect(() => parseSolverSolution(input)).toThrow(message);
    });
  }

  it("includes the path on the error", () => {
    try {
      parseSolverSolution({ id: "1", packages: [{ size: { x: 0, y: 1, z: 1 }, items: [] }] });
    } catch (error) {
      expect(error).toBeInstanceOf(SolverSolutionParseError);
      expect((error as SolverSolutionParseError).path).toBe("packages[0].size.x");
    }
  });
});

describe("toVisualiserCartons", () => {
  const cartons = toVisualiserCartons(reply, request);

  it("names each carton from the catalogue by its size", () => {
    expect(cartons.map((c) => [c.boxIndex, c.boxReference])).toEqual([
      [0, "MED"],
      [1, "SML"],
    ]);
  });

  it("labels an unknown carton size as CUSTOM", () => {
    const [carton] = toVisualiserCartons({ id: "x", packages: [{ size: { x: 10, y: 20, z: 30 }, items: [] }], unpacked: [] }, request);
    expect(carton.boxReference).toBe("CUSTOM-10x20x30");
  });

  it("converts millimetres to metres and swaps y/z for three.js", () => {
    expect(cartons[0].containerSize).toEqual({ x: 0.4, y: 0.4, z: 0.4 });
    expect(cartons[0].items[0].size).toEqual({ x: 0.075, y: 0.3, z: 0.15 });
    expect(cartons[1].items[1].position).toEqual({ x: 0.08, y: 0, z: 0 });
  });

  it("restores weight and box group from the request", () => {
    expect(cartons[0].items[0]).toMatchObject({ itemCode: "W-1", weight: 1.2, boxGroup: "A" });
  });

  it("matches items that share a code by reference and size", () => {
    expect(cartons[1].items.map((i) => [i.itemReference, i.weight])).toEqual([
      ["Glass", 0.4],
      ["Lid", 0.1],
    ]);
  });

  it("gives every item a unique id", () => {
    const ids = cartons.flatMap((c) => c.items.map((i) => i.uuid));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("0-W-1-0");
  });

  it("falls back to weight 0 for an item that was never requested", () => {
    const [carton] = toVisualiserCartons(
      { id: "x", packages: [{ size: { x: 150, y: 150, z: 150 }, items: [{ itemCode: "??", itemReference: "?", unit: 1, position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } }] }], unpacked: [] },
      request
    );
    expect(carton.items[0]).toMatchObject({ weight: 0, boxGroup: null });
  });
});

describe("describeUnpacked", () => {
  it("lists codes with reasons", () => {
    expect(
      describeUnpacked([
        { itemCode: "A", itemReference: "a", unit: 1, size: { x: 1, y: 1, z: 1 }, weight: 1, reason: "TooLarge" },
        { itemCode: "B", itemReference: "b", unit: 1, size: { x: 1, y: 1, z: 1 }, weight: 1, reason: "TooHeavy" },
      ])
    ).toBe("A (TooLarge), B (TooHeavy)");
  });
});
