# SemiRealistic Example — Solver Results

Packed with [dvdoug/boxpacker](https://github.com/dvdoug/boxpacker) 4.3 on PHP 8.4 via [../boxpacker-run.php](../boxpacker-run.php). No box supply limits; quantities are tuned so the bulk fills 3 Trunks and the remainder drops into a smaller box.

## Box candidates (in)

| Reference | Width | Length | Depth | Max Weight (kg) | Box Weight (kg) | Shape notes |
|-----------|------:|-------:|------:|----------------:|----------------:|-------------|
| Cube | 200 | 200 | 200 | 15 | 0.08 | Even in all 3 dimensions |
| Tube | 500 | 120 | 120 | 10 | 0.09 | Long and thin |
| Panel | 350 | 350 | 80 | 12 | 0.07 | Flat and wide |
| Crate | 300 | 250 | 200 | 25 | 0.12 | "Normal" box, no dimension dominates |
| Trunk | 450 | 400 | 350 | 40 | 0.2 | Large in all 3 dimensions |

Dimensions in millimetres.

## Items (in)

| ItemCode | ItemReference | Width | Length | Depth | Weight (kg) | Quantity |
|----------|---------------|------:|-------:|------:|------------:|---------:|
| BOOK | Hardback Book | 160 | 100 | 100 | 0.5 | 38 |
| SHOE | Shoebox | 160 | 160 | 100 | 0.6 | 20 |
| SKIL | Cast Iron Skillet (boxed) | 120 | 120 | 120 | 4.0 | 7 |
| MUG | Coffee Mug (boxed) | 80 | 80 | 80 | 0.15 | 50 |

115 units total.

## Packed boxes (out)

| Box | Type | Items | Utilisation | Gross (kg) | Contents |
|----:|------|------:|------------:|-----------:|----------|
| 1 | Trunk | 56 | 73.1% | 14.20 | 40× MUG, 16× BOOK |
| 2 | Trunk | 27 | 65.7% | 23.50 | 22× BOOK, 3× SKIL, 2× MUG |
| 3 | Trunk | 24 | 84.5% | 12.80 | 20× SHOE, 4× MUG |
| 4 | Crate | 8 | 59.7% | 16.72 | 4× SKIL, 4× MUG |

4 boxes used, 115 of 115 units packed, nothing left over. The remainder after 3 Trunks fits a Crate instead of opening a fourth Trunk.
