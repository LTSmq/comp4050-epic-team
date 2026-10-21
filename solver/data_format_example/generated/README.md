# generated/

Large mock orders in the Portal's shape, run through `/solve` and checked, with a live page that shows each solution as the solver pushes it out. Everything for this experiment lives in this folder.

## Quick start

Run these from this folder (`solver/data_format_example/generated/`), each in its own terminal:

```bash
# 1. the stand-in for the Visualizer: receives pushes, serves the live page
python3 receiver.py

# 2. the solver, pointed at that receiver (run this one from solver/)
VISUALIZER_URL=http://127.0.0.1:3000/solutions cargo run

# 3. open the live page
open http://127.0.0.1:3000

# 4. send every order through the endpoint, save and check the answers
python3 run_orders.py
```

Each solution appears on the page as it is pushed. You can also send orders from the page itself, with **Send order** or **Send all**.

## What's here

| Path | What it is |
| --- | --- |
| `generate_orders.py` | Builds `orders/`. It is seeded, so running it again gives identical orders. |
| `orders/*.json` | Ten mock orders in the shape of `../input_from_portal.json`, with the `id`, `Weight` and `boxTypes` that `/solve` requires. |
| `run_orders.py` | Posts each order to `/solve`, saves the answer in `solved/`, checks it, and writes `report.md` and `report.json`. Pass an endpoint to use another address. |
| `solved/*.json` | The solver's answers, in the Visualizer's shape. |
| `report.md`, `report.json` | Per-order results: carton count against a lower bound, fill, solve time, leftovers and any rule broken. |
| `receiver.py` | Stands in for the Visualizer's server. It accepts the solver's POST to `/solutions`, saves a copy in `received/`, and streams it to the live page. |
| `live.html` | The live 3D view. Open it through `receiver.py`; opened from disk it can only load saved files with **Load JSON**. |

## The orders

| Order | Units | What it is aimed at |
| --- | --- | --- |
| `GEN-01-ecommerce-mix` | 159 | 38 item types of every size, no groups, five carton sizes: carton choice by volume. |
| `GEN-02-grouped-goods` | 153 | `HAZMAT`, `FOOD` and `CHILLED` plus untagged stock: no carton may mix any two of them. |
| `GEN-03-awkward-geometry` | 101 | Rods and posters that only fit a tube lying lengthways, panels that only fit a flat, cubes that fill a carton to the millimetre, and one cube 1 mm too wide for its obvious carton. |
| `GEN-04-heavy-freight` | 59 | Weight decides the carton count. Items sit exactly at a carton's limit once its own weight is counted, and an anvil 0.5 kg over every limit must be left unpacked. |
| `GEN-05-bulk-small` | 550 | Hundreds of small units, for stacking and speed. |
| `GEN-06-partial-and-supply` | 87 | Supply caps on every carton. A sofa that fits only an inactive carton and a safe too heavy for any carton must both be left over, and the inactive carton must never be used. |
| `GEN-07-load_1000` | 1,000 | Deterministic large-order load test with ten item types and two carton types. |
| `GEN-08-load_2500` | 2,500 | Deterministic large-order load test with ten item types and two carton types. |
| `GEN-09-load_5000` | 5,000 | Deterministic large-order load test with ten item types and two carton types. |
| `GEN-10-load_10000` | 10,000 | Deterministic large-order load test with ten item types and two carton types. |

Each item type in an order has its own unique set of three sides. A solution carries only positions and sizes, so this is what lets the checker and the live page trace every placed box back to its item type, weight and group exactly.

## What is checked

`run_orders.py` and the live page each check every solution independently, without using the solver's own code:

- every unit is accounted for, and nothing appears that wasn't ordered;
- anything left over could genuinely not fit: too big or too heavy for every active carton, or the supply ran out;
- nothing pokes outside its carton, and no two items overlap;
- every item off the floor stands on at least 80% of its base;
- no carton is over its weight limit, counting the carton's own weight;
- no carton mixes groups, with untagged items counted as a group of their own;
- no carton type exceeds its `MaximumBoxes`, and inactive types are never used.

On the page, an item is outlined amber if it is poorly supported and red if it overlaps another or pokes outside its carton.

The lower bound in the report is the larger of two figures: the total volume over the largest carton's volume, and the total weight over the largest carton's payload. No packing can beat it, but it ignores shape, so it is loose for orders like `GEN-03`, where items need particular cartons.

## Large-order load test

Four deterministic load-test orders were added to measure solver performance at
1,000, 2,500, 5,000 and 10,000 units. Each order contains ten item types and
uses the same two active carton types. All four orders were successfully packed
and passed the checks in `run_orders.py`.

| Units | Solve time | Peak solver memory | Result |
| ---: | ---: | ---: | --- |
| 1,000 | 2.353 s | 15.8 MB | PASS |
| 2,500 | 5.733 s | 17.6 MB | PASS |
| 5,000 | 13.303 s | 19.9 MB | PASS |
| 10,000 | 38.822 s | 22.6 MB | PASS |

The measurements were taken locally on Windows using the Rust debug build
(`cargo run`). Solve time was measured around the HTTP `/solve` request. Peak
memory is the maximum Windows working set observed for the running solver
process while each request was being solved, sampled approximately every
100 ms.

The largest tested order was 10,000 units. It packed all 10,000 units
successfully in approximately 38.8 seconds with an observed peak working set of
22.6 MB. Therefore, 10,000 units is the largest order size verified by this
load test; this is a tested maximum rather than a claim that larger orders
cannot be processed.

## Placeholders

The weights, groups and carton specifications are invented for testing, not real data.
