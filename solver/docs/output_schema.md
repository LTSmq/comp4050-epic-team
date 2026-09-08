# Solver Output Contract

The solver exposes packing results through `POST /solve`.

The public JSON contract is intentionally kept separate from the solver's
internal optimisation types so the packing implementation can change without
breaking Portal or Visualiser.

## Coordinate System

All dimensions and positions are expressed in millimetres.

The solver uses:

- X = carton width direction
- Y = carton length direction
- Z = vertical direction

`X`, `Y` and `Z` on a placed item describe the minimum/bottom corner of the
item, not its centre.

## Rotation

The dimensions nested inside `Item` describe the item's original dimensions.

The `Width`, `Length` and `Depth` fields directly on a placed item describe the
actual orientation selected by the solver.

Visualisation clients should therefore render using the placed dimensions.

## Response Shape

```json
{
  "PackedBoxes": [
    {
      "BoxIndex": 0,
      "BoxType": {
        "Reference": "MED",
        "Width": 400,
        "Length": 400,
        "Depth": 400,
        "MaxWeight": 25.0,
        "BoxWeight": 0.75,
        "Active": true,
        "MaximumBoxes": null
      },
      "PlacedItems": [
        {
          "Item": {
            "ItemCode": "ITEM-001",
            "ItemReference": "Example Item",
            "Width": 100,
            "Length": 200,
            "Depth": 50,
            "Weight": 1.0,
            "BoxGroup": null
          },
          "X": 0,
          "Y": 0,
          "Z": 0,
          "Width": 200,
          "Length": 100,
          "Depth": 50
        }
      ]
    }
  ]
}
```

## Visualiser Integration

The solver uses Z as the vertical axis.

The current visualiser maps solver coordinates into Three.js as:

- Solver X -> Visualiser X
- Solver Z -> Visualiser Y
- Solver Y -> Visualiser Z

The solver should not perform this conversion itself. The visualiser adapter is
responsible for converting coordinates and millimetres into its rendering format.

## Multiple Cartons

PackedBoxes may contain more than one carton.

Clients must not assume that only the first carton is relevant.

## Errors

If the request is valid but the complete order cannot be packed, the current
MVP HTTP API returns HTTP 400 with:

{
  "Error": "description of why the order could not be packed"
}

Malformed JSON requests are rejected by the HTTP framework before the packing
engine is called.