# Solver output schema

This is the JSON the solver produces for a packed order. It is written for the Visualizer
team, who draw it, and for anyone else who reads a solution.

The same body reaches you in two ways:

- **As the reply to `POST /solve`**, on the connection that sent the order.
- **As a delivery to the Visualizer**: when `VISUALIZER_URL` is set, the solver POSTs the
  identical body there, byte for byte, with `Content-Type: application/json`.

The shape is the one in `data_format_example/solved_soltuion_example.json`, plus one key,
`unpacked`, which the Visualizer team has agreed to.

## Complete example

This is real output, not hand-written. The order was the `Simple` example
(`docs/example_data/combined.json`) with `OrderId` set to `Order-1042` and one extra item,
a 900 × 600 × 1800 mm display cabinet, that is too big for every carton offered.

```json
{
  "id": "Order-1042",
  "packages": [
    {
      "size": { "x": 400, "y": 400, "z": 400 },
      "items": [
        { "position": { "x": 0, "y": 0, "z": 0 }, "size": { "x": 75, "y": 150, "z": 300 } }
      ]
    },
    {
      "size": { "x": 400, "y": 400, "z": 400 },
      "items": [
        { "position": { "x": 0, "y": 0, "z": 0 }, "size": { "x": 50, "y": 100, "z": 200 } }
      ]
    },
    {
      "size": { "x": 150, "y": 150, "z": 150 },
      "items": [
        { "position": { "x": 0, "y": 0, "z": 0 }, "size": { "x": 80, "y": 80, "z": 120 } }
      ]
    }
  ],
  "unpacked": [
    {
      "itemCode": "ITM-900",
      "itemReference": "Display cabinet",
      "size": { "x": 900, "y": 600, "z": 1800 },
      "weight": 45.0,
      "reason": "TooLarge"
    }
  ]
}
```

There are three cartons because the three items belong to three different groups (`GROUP-A`,
`GROUP-B` and untagged), and groups never share a carton. The first item was ordered as
300 × 150 × 75 and placed on its end as 75 × 150 × 300: `size` on a placed item is always
after rotation.

## Units and axes

- **Every length is in whole millimetres**, written as a JSON integer. The Visualizer's
  example uses fractions; the solver never does.
- **Weights are in kilograms**, as a JSON number that may have a fraction (`45.0`, `2.8`).
- **`x`, `y`, `z` are the carton's Width, Length and Depth**, in the same order as in the
  order's `Width`, `Length` and `Depth` fields.
- **z is vertical.** z = 0 is the carton floor, and items are stacked by increasing z.
  three.js and most other 3D libraries put y up, so swap y and z when drawing, or rotate the
  scene.
- **Positions start at the carton's corner.** `(0, 0, 0)` is the bottom corner of the
  carton, and every coordinate is zero or positive.

## Fields

### Top level

| Key | Type | Always present | Meaning |
| --- | --- | --- | --- |
| `id` | string | yes | The order's id: `id` in the Portal's shape, `OrderId` in the older one. Use it to match the solution to its order. If the order had no id, the solver makes one up in the form `solve-<milliseconds>-<count>`. |
| `packages` | array of package | yes | One entry per carton used. Empty if the order had no items. |
| `unpacked` | array of unpacked entry | yes | Items that fit in no carton. Empty when everything was placed. |

### Package

| Key | Type | Meaning |
| --- | --- | --- |
| `size` | `{x, y, z}` | The carton's inside dimensions, as given in the order's box types. |
| `items` | array of placed item | What is inside this carton. Never empty. |

A package does not say which carton type it is, and it has no weight. Two cartons of the same
type have the same `size`, so `size` is the only way to tell types apart.

### Placed item

| Key | Type | Meaning |
| --- | --- | --- |
| `position` | `{x, y, z}` | Where the item's corner nearest the carton's `(0, 0, 0)` sits. |
| `size` | `{x, y, z}` | How much space the item takes up **after rotation**. Draw it as an axis-aligned box from `position` to `position + size`. You never have to work the rotation out yourself. |

Each item fits inside its carton (`position + size <= package.size` on every axis), and no
two items in one carton overlap. Every item is either on the floor or has at least 80% of
its base resting on items below it.

A placed item does **not** say which item from the order it is: there is no item code,
reference, weight or group. Every unit of the same order line looks identical. This is a
known gap; see *Not in the output* below.

### Unpacked entry

| Key | Type | Meaning |
| --- | --- | --- |
| `itemCode` | string | `ItemCode` from the order. |
| `itemReference` | string | `ItemReference` from the order. |
| `size` | `{x, y, z}` | The item's `Width`, `Length`, `Depth` **as ordered**, not rotated, since it was never placed. |
| `weight` | number | `Weight` from the order, in kilograms. |
| `reason` | string | One of the four codes below. |

Unpacked entries use camelCase keys, unlike the Portal's PascalCase item fields. An order
line that was split into several units can appear several times, once per unit left over.

## Reason codes

`reason` is always exactly one of these strings. Use them to decide what to show; they will
not be reworded.

| Code | Meaning |
| --- | --- |
| `TooLarge` | Bigger than every carton offered, in every orientation it may take. |
| `TooHeavy` | Fits inside at least one carton, but would take that carton over its `MaxWeight`. The carton's own `BoxWeight` counts towards that limit. |
| `SupplyExhausted` | Would fit, but every carton type that could hold it had used up its `MaximumBoxes`. |
| `CartonLimitReached` | Would fit, but the solver hit its limit on how many cartons it may open in one run. |

If more than one reason applies, the solver reports the nearest miss. For example, an item
that fits one carton but is too heavy for it is `TooHeavy`, even if it is too big for every
other carton.

## A 200 does not mean everything was packed

**Always check `unpacked`.** The solver packs what it can and returns a 200, so a partial
solution has the same status code as a complete one. A viewer that ignores `unpacked` will
show a partial order as if it were finished.

| Situation | Status | `packages` | `unpacked` |
| --- | --- | --- | --- |
| Everything placed | 200 | one or more | `[]` |
| Some items placed | 200 | one or more | one or more |
| Order had no items | 200 | `[]` | `[]` |
| Items but nothing could be placed | 400 | (error body) | (error body) |

Only a 200 produces a solution, so only a 200 is delivered to `VISUALIZER_URL`. Any other
status is answered only to the caller, and the solver's own errors carry this body:

```json
{ "Error": "Could not pack item P (Pallet). It is larger than every carton offered." }
```

| Status | Meaning | Body |
| --- | --- | --- |
| 400 | The order was understood but nothing could be packed at all, or the cartons were unusable (none active, or a side of zero). | `{"Error": …}` |
| 400 | The body is not JSON at all. | plain text |
| 413 | More than 10,000 items or more than 100 box types. | `{"Error": …}` |
| 413 | The body is over 4 MB. | plain text |
| 415 | The request has no `Content-Type: application/json` header. | plain text |
| 422 | JSON, but not a usable order: a field is missing or misspelled. The message names it. | `{"Error": …}` |
| 500 | The solver crashed. That is a solver bug; report it with the order id. | `{"Error": …}` |

The plain-text cases are rejected by the web framework before the solver sees the request,
so check the `Content-Type` of an error reply before parsing it as JSON. `Error` is
PascalCase, matching the order fields. Messages are for people to read and may change;
branch on the status code, not the message.

## Order of things

The order of `packages`, of `items` within a package and of `unpacked` carries no meaning
and may change between solver versions. Do not number cartons by their place in the array
and expect the numbers to stay the same across two solves of the same order.

## Not in the output

None of these are in a solution today. Raise it with the Solver team if a view needs one:

- Which order line a placed item came from (no item code or reference on a placed item).
- The carton type's `Reference` on a package.
- Weights of cartons or of placed items.
- Group (`BoxGroup`) of a package or item.
- Utilisation or any other summary figures. All of these can be worked out from the
  geometry.

## Changing this format

Renaming, removing or retyping any key above breaks the Visualizer, and the Portal through
it. `test_solution_matches_the_visualizer_example_shape` in `tests/solver_tests.rs` compares
every key against `solved_soltuion_example.json` to catch that. Adding a key is safe for
readers that ignore unknown keys, but still needs the Visualizer team's agreement first.
