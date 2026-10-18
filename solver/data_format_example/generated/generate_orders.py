"""Builds the mock orders in orders/, in the portal's shape.

The shape is the one in ../input_from_portal.json, plus the three fields /solve
needs that the portal's example does not have yet: an id, a Weight on every
item and a boxTypes list. Each order is aimed at one part of the solver, so a
failure points somewhere specific. Item quantities are expanded into one entry
per unit, since the solver has no Quantity field.

Every item type in an order has its own set of three sides, so a solution, which
carries only positions and sizes, can be mapped back to item types exactly. The
checker in run_orders.py relies on that.

The random generator is seeded, so running this again gives the same orders.

    python3 generate_orders.py
"""

import json
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "orders"


def box(ref, w, l, d, max_weight, tare, active=True, max_boxes=None):
    return {
        "Reference": ref, "Width": w, "Length": l, "Depth": d,
        "MaxWeight": max_weight, "BoxWeight": tare,
        "Active": active, "MaximumBoxes": max_boxes,
    }


class Order:
    """Collects item types for one order and keeps their dimensions unique."""

    def __init__(self, order_id, rng):
        self.order_id = order_id
        self.rng = rng
        self.lines = []
        self.taken = set()

    def add(self, code, ref, w, l, d, weight, qty, group=None):
        key = tuple(sorted((w, l, d)))
        if key in self.taken:
            raise ValueError(f"{self.order_id}: {code} repeats the sides of another item type")
        self.taken.add(key)
        self.lines.append((code, ref, w, l, d, round(weight, 2), qty, group))

    def add_random(self, prefix, count, sides, weight_per_litre, qty, group=None, ref="Item"):
        """Adds count item types with sides drawn from the given (low, high) range."""
        made = 0
        while made < count:
            w, l, d = (self.rng.randrange(sides[0], sides[1] + 1, 5) for _ in range(3))
            key = tuple(sorted((w, l, d)))
            if key in self.taken:
                continue
            litres = w * l * d / 1_000_000
            weight = max(0.05, litres * weight_per_litre * self.rng.uniform(0.6, 1.4))
            self.add(f"{prefix}-{made + 1:03d}", f"{ref} {made + 1}", w, l, d, weight,
                     self.rng.randint(*qty) if isinstance(qty, tuple) else qty, group)
            made += 1

    def build(self, box_types):
        items = []
        for code, ref, w, l, d, weight, qty, group in self.lines:
            for _ in range(qty):
                items.append({
                    "ItemCode": code, "ItemReference": ref,
                    "Width": w, "Length": l, "Depth": d,
                    "Weight": weight, "BoxGroup": group,
                })
        # Shuffled, so the solver cannot lean on the order lines arrive in.
        self.rng.shuffle(items)
        return {
            "id": self.order_id, "source": "Generated", "status": "Draft",
            "items": items, "boxTypes": box_types,
        }


# A general carton range, smallest to largest, used by several orders.
STANDARD_BOXES = [
    box("MAILER", 250, 180, 100, 5.0, 0.2),
    box("SMALL", 300, 300, 200, 12.0, 0.4),
    box("MEDIUM", 450, 350, 300, 20.0, 0.7),
    box("LARGE", 600, 400, 400, 30.0, 1.0),
    box("XL", 800, 600, 500, 40.0, 1.6),
]


def ecommerce_mix(rng):
    """Many item types of every size, no groups. Tests carton choice on volume."""
    o = Order("GEN-01-ecommerce-mix", rng)
    o.add_random("SKU-S", 18, (40, 150), 0.6, (2, 8), ref="Small item")
    o.add_random("SKU-M", 14, (120, 280), 0.4, (1, 5), ref="Medium item")
    o.add_random("SKU-L", 6, (250, 380), 0.25, (1, 3), ref="Large item")
    return o.build(STANDARD_BOXES)


def grouped_goods(rng):
    """Three groups plus untagged stock. No carton may mix any two of the four."""
    o = Order("GEN-02-grouped-goods", rng)
    o.add_random("HAZ", 6, (80, 220), 1.1, (3, 8), group="HAZMAT", ref="Corrosive")
    o.add_random("FOOD", 8, (60, 200), 0.7, (4, 10), group="FOOD", ref="Dry food")
    o.add_random("COLD", 5, (100, 250), 0.9, (2, 6), group="CHILLED", ref="Chilled")
    o.add_random("GEN", 10, (50, 260), 0.5, (2, 7), ref="General")
    return o.build(STANDARD_BOXES)


def awkward_geometry(rng):
    """Shapes that only fit one way, or only one carton, or by a millimetre."""
    o = Order("GEN-03-awkward-geometry", rng)
    boxes = [
        box("TUBE", 100, 100, 1000, 6.0, 0.3),
        box("FLAT", 700, 500, 60, 10.0, 0.5),
        box("CUBE", 300, 300, 300, 15.0, 0.5),
        box("CRATE", 600, 500, 450, 35.0, 2.0),
    ]
    o.add("ROD-950", "Curtain rod", 950, 40, 40, 1.2, 6)       # TUBE only, lying along its length
    o.add("POSTER-980", "Poster roll", 90, 90, 980, 0.4, 4)    # TUBE with 10 mm to spare
    o.add("PANEL-690", "Glass panel", 690, 490, 50, 6.0, 3)    # FLAT, one per carton
    o.add("SHEET-680", "Mirror sheet", 680, 480, 20, 3.0, 6)   # FLAT, stacked thin
    o.add("EXACT-300", "Exact cube", 300, 300, 300, 4.0, 5)    # fills CUBE to the millimetre
    o.add("EXACT-150", "Eighth cube", 150, 150, 150, 0.8, 16)  # eight fill a CUBE exactly
    o.add("NEAR-301", "One mm too wide", 301, 300, 299, 4.0, 2)  # misses CUBE, needs CRATE
    o.add("PLANK-580", "Plank", 580, 90, 30, 1.1, 12)
    o.add("SLAB-590", "Stone slab", 590, 490, 40, 9.0, 4)
    o.add_random("FILL", 8, (40, 120), 0.5, (3, 8), ref="Filler")
    return o.build(boxes)


def heavy_freight(rng):
    """Weight, not space, decides how many cartons are needed."""
    o = Order("GEN-04-heavy-freight", rng)
    boxes = [
        box("HD-SMALL", 300, 300, 300, 15.0, 1.0),
        box("HD-LARGE", 500, 500, 400, 30.0, 2.0),
    ]
    o.add("PLATE-14", "Steel plate", 280, 280, 20, 14.0, 4)    # 14 + 1 tare is HD-SMALL's limit exactly
    o.add("INGOT-28", "Lead ingot", 200, 100, 60, 28.0, 3)     # 28 + 2 tare is HD-LARGE's limit exactly
    o.add("ANVIL-29", "Anvil", 300, 200, 150, 28.5, 1)         # 0.5 kg over everything: must be unpacked
    o.add("BOLTS-6", "Bolt bucket", 180, 180, 200, 6.0, 8)
    o.add("CHAIN-9", "Chain coil", 250, 250, 120, 9.0, 5)
    o.add("BRICK-3", "Brick pack", 215, 102, 65, 3.2, 20)
    o.add_random("TOOL", 8, (100, 280), 0.8, (1, 4), ref="Tool case")
    return o.build(boxes)


def bulk_small(rng):
    """Hundreds of small units, to see stacking and speed at volume."""
    o = Order("GEN-05-bulk-small", rng)
    boxes = [
        box("TOTE", 400, 300, 250, 18.0, 0.8),
        box("BIN", 600, 400, 350, 25.0, 1.2),
    ]
    o.add_random("BULK", 10, (40, 110), 0.5, (40, 70), ref="Bulk item")
    return o.build(boxes)


def partial_and_supply(rng):
    """Leftovers on purpose: things too big, too heavy, or out of cartons."""
    o = Order("GEN-06-partial-and-supply", rng)
    boxes = [
        box("SML", 200, 200, 200, 6.0, 0.3, max_boxes=3),
        box("MED", 400, 300, 300, 15.0, 0.6, max_boxes=4),
        box("BIG", 600, 500, 500, 25.0, 1.2, max_boxes=2),
        # The ideal home for the oversized item, but inactive, so it must never appear.
        box("JUMBO", 1500, 1200, 1000, 80.0, 5.0, active=False),
    ]
    o.add("SOFA-1400", "Sofa section", 1400, 900, 800, 40.0, 1)  # fits only the inactive JUMBO
    o.add("SAFE-30", "Small safe", 250, 250, 250, 30.0, 1)       # fits BIG by size, too heavy for all
    o.add("LAMP-450", "Floor lamp", 120, 120, 450, 2.5, 6)
    o.add("KETTLE-220", "Kettle", 220, 180, 240, 1.4, 10)
    o.add_random("HOME", 10, (60, 200), 0.6, (3, 9), ref="Homeware")
    return o.build(boxes)


ORDERS = [ecommerce_mix, grouped_goods, awkward_geometry, heavy_freight, bulk_small, partial_and_supply]


def main():
    OUT.mkdir(exist_ok=True)
    for index, make in enumerate(ORDERS):
        # Each order gets its own seed, so adding an order never changes the others.
        order = make(random.Random(4050 + index))
        path = OUT / f"{order['id']}.json"
        path.write_text(json.dumps(order, indent=2) + "\n")
        types = len({item["ItemCode"] for item in order["items"]})
        print(f"{path.name}: {len(order['items'])} units, {types} item types, "
              f"{len(order['boxTypes'])} carton types")


if __name__ == "__main__":
    main()
