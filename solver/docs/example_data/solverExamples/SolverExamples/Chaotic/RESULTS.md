# Chaotic Example — Solver Results

Packed with [dvdoug/boxpacker](https://github.com/dvdoug/boxpacker) 4.3 on PHP 8.4. Runtime ~0.2s. Items with no BoxGroup can share a box with any group, so they pack in the same pass as the largest group (CORROSIVE); FOOD packs separately. See [SCENARIO.md](SCENARIO.md) for the traps built into this dataset.

## Box candidates (in)

| Reference | Width | Length | Depth | Max Weight (kg) | Box Weight (kg) | Limit |
|-----------|------:|-------:|------:|----------------:|----------------:|-------|
| Poster Tube | 600 | 90 | 90 | 3 | 0.4 | — |
| Picture Box | 500 | 450 | 45 | 4 | 0.3 | — |
| Parts Box | 210 | 160 | 110 | 30 | 0.1 | — |
| Large Cube | 550 | 550 | 550 | 5 | 1.5 | — |
| Standard Carton | 400 | 300 | 250 | 20 | 0.5 | max 2 |
| Golf Bag Box | 1000 | 250 | 200 | 18 | 2.0 | max 12 |
| Legacy Carton | 450 | 350 | 300 | 50 | 0.6 | inactive |

Dimensions in millimetres.

## Items (in)

| ItemCode | ItemReference | Width | Length | Depth | Weight (kg) | Quantity | BoxGroup |
|----------|---------------|------:|-------:|------:|------------:|---------:|----------|
| ROD-A | Steel Rod (long) | 590 | 80 | 80 | 0.9 | 6 | — |
| ROD-B | Aluminium Rod | 585 | 85 | 85 | 0.4 | 9 | — |
| POLE | Fibreglass Pole | 990 | 70 | 70 | 2.2 | 6 | — |
| TILE-XL | Ceramic Tile Sheet XL | 495 | 445 | 40 | 1.8 | 4 | — |
| GLASS | Tempered Glass Sheet | 540 | 540 | 20 | 4.5 | 3 | — |
| TILE-ODD | Offcut Tile Sheet | 470 | 430 | 44 | 1.1 | 5 | — |
| INGOT | Zinc Ingot | 200 | 150 | 100 | 15.0 | 10 | — |
| ANVIL | Bench Anvil (crated) | 390 | 290 | 240 | 19.5 | 2 | — |
| SHOT | Lead Shot Bag | 90 | 90 | 90 | 2.9 | 20 | — |
| FOAM | Foam Block | 540 | 540 | 260 | 0.6 | 4 | — |
| PILLOW | Body Pillow (bagged) | 500 | 400 | 300 | 0.8 | 6 | — |
| PRISM | Prism Carton | 170 | 170 | 170 | 1.3 | 12 | — |
| WEDGE | Door Wedge Pack | 330 | 190 | 60 | 0.7 | 10 | — |
| BATON | Relay Baton Tube | 410 | 60 | 60 | 0.5 | 12 | — |
| ACID | Acid Bottle (boxed) | 100 | 100 | 200 | 1.9 | 8 | CORROSIVE |
| TIN | Canned Food Tin | 100 | 100 | 110 | 0.85 | 16 | FOOD |
| JUG | Bleach Jug | 150 | 110 | 250 | 2.1 | 6 | CORROSIVE |
| JAR | Spice Jar | 60 | 60 | 130 | 0.2 | 18 | FOOD |
| EXACT | Exact-Fit Insert | 210 | 160 | 110 | 0.9 | 3 | — |
| ALMOST | Almost-Golden Carton | 401 | 300 | 250 | 1.0 | 2 | — |
| BAIT | Overlength Rod | 640 | 80 | 80 | 1.2 | 2 | — |
| CUBE-89 | 89mm Filler Cube | 89 | 89 | 89 | 0.05 | 30 | — |
| LEAD | Lead Sheet | 490 | 440 | 10 | 3.9 | 2 | — |
| DUMBBELL | Cast Dumbbell (boxed) | 350 | 140 | 140 | 11.0 | 2 | — |
| BEAD | Micro Bead Pouch | 30 | 30 | 30 | 0.01 | 40 | — |
| BRICK | Engineering Brick | 200 | 110 | 80 | 3.0 | 24 | — |
| PANE | Acrylic Pane (padded) | 340 | 340 | 70 | 1.5 | 10 | — |
| TOWER | Poster Tower Tube | 540 | 100 | 100 | 1.7 | 8 | — |
| NEARCUBE | Near-Cube Carton | 185 | 180 | 175 | 2.4 | 10 | — |
| FEATHER | Feather Sample Box | 60 | 60 | 60 | 0.02 | 10 | — |

30 item types, 300 units total.

## Packed boxes (out)

| Box | Group | Type | Items | Utilisation | Gross (kg) | Contents |
|----:|-------|------|------:|------------:|-----------:|----------|
| 1 | CORROSIVE + ungrouped | Golf Bag Box | 60 | 61.8% | 20.00 | 40× BEAD, 10× FEATHER, 6× CUBE-89, 2× NEARCUBE, 1× DUMBBELL, 1× PRISM |
| 2 | CORROSIVE + ungrouped | Golf Bag Box | 16 | 71.7% | 17.60 | 6× ROD-A, 6× CUBE-89, 3× BRICK, 1× EXACT |
| 3 | CORROSIVE + ungrouped | Golf Bag Box | 11 | 70.3% | 18.50 | 3× ROD-B, 3× BRICK, 2× JUG, 1× WEDGE, 1× EXACT, 1× BATON |
| 4 | CORROSIVE + ungrouped | Golf Bag Box | 10 | 76.4% | 17.70 | 4× PRISM, 2× POLE, 2× BATON, 1× JUG, 1× BRICK |
| 5 | CORROSIVE + ungrouped | Golf Bag Box | 10 | 73.1% | 20.00 | 3× NEARCUBE, 3× WEDGE, 3× ACID, 1× BRICK |
| 6 | CORROSIVE + ungrouped | Golf Bag Box | 10 | 73.1% | 20.00 | 3× NEARCUBE, 3× WEDGE, 3× ACID, 1× BRICK |
| 7 | CORROSIVE + ungrouped | Golf Bag Box | 10 | 71.7% | 18.35 | 3× TOWER, 2× PRISM, 2× BRICK, 1× JUG, 1× BATON, 1× CUBE-89 |
| 8 | CORROSIVE + ungrouped | Golf Bag Box | 10 | 71.7% | 18.35 | 3× TOWER, 2× PRISM, 2× BRICK, 1× JUG, 1× BATON, 1× CUBE-89 |
| 9 | CORROSIVE + ungrouped | Golf Bag Box | 10 | 63.3% | 17.35 | 2× TOWER, 2× PRISM, 2× ACID, 1× JUG, 1× BATON, 1× SHOT, 1× CUBE-89 |
| 10 | CORROSIVE + ungrouped | Golf Bag Box | 9 | 72.8% | 8.10 | 4× ROD-B, 3× WEDGE, 2× BAIT |
| 11 | CORROSIVE + ungrouped | Golf Bag Box | 8 | 62.8% | 17.60 | 4× POLE, 2× ROD-B, 2× BRICK |
| 12 | CORROSIVE + ungrouped | Golf Bag Box | 5 | 54.2% | 20.00 | 2× NEARCUBE, 1× DUMBBELL, 1× PRISM, 1× EXACT |
| 13 | CORROSIVE + ungrouped | Large Cube | 4 | 55.6% | 6.35 | 1× PILLOW, 1× ALMOST, 1× BRICK, 1× CUBE-89 |
| 14 | CORROSIVE + ungrouped | Large Cube | 4 | 21.4% | 5.90 | 4× TILE-ODD |
| 15 | CORROSIVE + ungrouped | Poster Tube | 3 | 59.4% | 1.00 | 2× CUBE-89, 1× BATON |
| 16 | CORROSIVE + ungrouped | Poster Tube | 3 | 59.4% | 1.00 | 2× CUBE-89, 1× BATON |
| 17 | CORROSIVE + ungrouped | Poster Tube | 3 | 59.4% | 1.00 | 2× CUBE-89, 1× BATON |
| 18 | CORROSIVE + ungrouped | Poster Tube | 3 | 59.4% | 1.00 | 2× CUBE-89, 1× BATON |
| 19 | CORROSIVE + ungrouped | Poster Tube | 3 | 59.4% | 1.00 | 2× CUBE-89, 1× BATON |
| 20 | CORROSIVE + ungrouped | Poster Tube | 3 | 59.4% | 1.00 | 2× CUBE-89, 1× BATON |
| 21 | CORROSIVE + ungrouped | Large Cube | 3 | 55.2% | 6.30 | 1× PILLOW, 1× ALMOST, 1× BRICK |
| 22 | CORROSIVE + ungrouped | Poster Tube | 3 | 44.0% | 3.40 | 2× CUBE-89, 1× SHOT |
| 23 | CORROSIVE + ungrouped | Large Cube | 3 | 15.1% | 5.60 | 2× PANE, 1× TILE-ODD |
| 24 | CORROSIVE + ungrouped | Parts Box | 2 | 95.2% | 6.10 | 2× BRICK |
| 25 | CORROSIVE + ungrouped | Large Cube | 2 | 91.1% | 2.70 | 2× FOAM |
| 26 | CORROSIVE + ungrouped | Large Cube | 2 | 91.1% | 2.70 | 2× FOAM |
| 27 | CORROSIVE + ungrouped | Parts Box | 2 | 39.4% | 5.90 | 2× SHOT |
| 28 | CORROSIVE + ungrouped | Parts Box | 2 | 39.4% | 5.90 | 2× SHOT |
| 29 | CORROSIVE + ungrouped | Parts Box | 2 | 39.4% | 5.90 | 2× SHOT |
| 30 | CORROSIVE + ungrouped | Parts Box | 2 | 39.4% | 5.90 | 2× SHOT |
| 31 | CORROSIVE + ungrouped | Parts Box | 2 | 39.4% | 5.90 | 2× SHOT |
| 32 | CORROSIVE + ungrouped | Parts Box | 2 | 39.4% | 5.90 | 2× SHOT |
| 33 | CORROSIVE + ungrouped | Parts Box | 2 | 39.4% | 5.90 | 2× SHOT |
| 34 | CORROSIVE + ungrouped | Parts Box | 2 | 39.4% | 5.90 | 2× SHOT |
| 35 | CORROSIVE + ungrouped | Parts Box | 2 | 39.4% | 5.90 | 2× SHOT |
| 36 | CORROSIVE + ungrouped | Large Cube | 2 | 37.1% | 5.30 | 1× PILLOW, 1× BRICK |
| 37 | CORROSIVE + ungrouped | Large Cube | 2 | 37.1% | 5.30 | 1× PILLOW, 1× BRICK |
| 38 | CORROSIVE + ungrouped | Large Cube | 2 | 37.1% | 5.30 | 1× PILLOW, 1× BRICK |
| 39 | CORROSIVE + ungrouped | Large Cube | 2 | 37.1% | 5.30 | 1× PILLOW, 1× BRICK |
| 40 | CORROSIVE + ungrouped | Large Cube | 2 | 10.6% | 5.10 | 2× TILE-XL |
| 41 | CORROSIVE + ungrouped | Large Cube | 2 | 10.6% | 5.10 | 2× TILE-XL |
| 42 | CORROSIVE + ungrouped | Large Cube | 2 | 9.7% | 4.50 | 2× PANE |
| 43 | CORROSIVE + ungrouped | Large Cube | 2 | 9.7% | 4.50 | 2× PANE |
| 44 | CORROSIVE + ungrouped | Large Cube | 2 | 9.7% | 4.50 | 2× PANE |
| 45 | CORROSIVE + ungrouped | Large Cube | 2 | 9.7% | 4.50 | 2× PANE |
| 46 | CORROSIVE + ungrouped | Standard Carton | 1 | 90.5% | 20.00 | 1× ANVIL |
| 47 | CORROSIVE + ungrouped | Standard Carton | 1 | 90.5% | 20.00 | 1× ANVIL |
| 48 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 49 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 50 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 51 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 52 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 53 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 54 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 55 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 56 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 57 | CORROSIVE + ungrouped | Parts Box | 1 | 81.2% | 15.10 | 1× INGOT |
| 58 | CORROSIVE + ungrouped | Parts Box | 1 | 47.6% | 3.10 | 1× BRICK |
| 59 | CORROSIVE + ungrouped | Picture Box | 1 | 21.3% | 4.20 | 1× LEAD |
| 60 | CORROSIVE + ungrouped | Picture Box | 1 | 21.3% | 4.20 | 1× LEAD |
| 61 | CORROSIVE + ungrouped | Large Cube | 1 | 3.5% | 6.00 | 1× GLASS |
| 62 | CORROSIVE + ungrouped | Large Cube | 1 | 3.5% | 6.00 | 1× GLASS |
| 63 | CORROSIVE + ungrouped | Large Cube | 1 | 3.5% | 6.00 | 1× GLASS |
| 64 | FOOD | Large Cube | 15 | 5.0% | 5.80 | 13× JAR, 2× TIN |
| 65 | FOOD | Large Cube | 8 | 3.8% | 5.70 | 4× TIN, 4× JAR |
| 66 | FOOD | Large Cube | 6 | 3.6% | 5.95 | 5× TIN, 1× JAR |
| 67 | FOOD | Large Cube | 5 | 3.3% | 5.75 | 5× TIN |

67 boxes used, 300 of 300 units packed, nothing left over. 
