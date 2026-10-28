# reversed/

Files derived from the two examples in the folder above. The **placeholders** listed below are guesses, not real data.

| File | What it is |
| --- | --- |
| `order_from_solved_example.json` | The order behind `solved_soltuion_example.json`, worked backwards into the Portal shape `/solve` accepts. |
| `input_from_portal_completed.json` | `input_from_portal.json` with the fields `/solve` requires filled in. This is the exact body that was posted. |

## order_from_solved_example.json

- **Units:** the example's numbers are read as metres and scaled to whole millimetres (×1000), since the solver works in millimetres. So a package of size 1 becomes a 1000 mm carton.
- **Box types:** one per distinct package size, named `BOX-1` to `BOX-3` in order of appearance. No weight limits or supply caps, because the example says nothing about either.
- **Items:** one entry per placed unit (23). Units with the same three sides, in any order, share an item code (`ITEM-001` to `ITEM-005`). Each unit keeps the orientation it had in the example, so `ITEM-003` appears both as 1750×1500×250 and as 250×1500×1750.
- **Placeholders:** every `Weight` is 1.0 kg and every `BoxGroup` is null. The example carries no weights or groups.
- **id:** `Order-A`, taken from the example.

Posting this order back to `/solve` does not reproduce the example's packing. The solver puts all 23 units into two `BOX-2` cartons rather than spreading them over the three box types. The example was laid out by hand, so this is expected, not a defect.

## input_from_portal_completed.json

Added to the Portal's example, which `/solve` otherwise rejects with a 422:

- `id`: `PORTAL-EXAMPLE-001` (placeholder).
- `Weight`: 1.0 kg on each item (placeholder).
- `boxTypes`: the cartons in `docs/example_data/boxes.json` (SML 150³, MED 400³, and LRG 1200³, which is inactive).

Posted to `/solve`, both items end up together in one MED carton.
