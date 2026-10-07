# Simple Example — Solver Results

Packed with [dvdoug/boxpacker](https://github.com/dvdoug/boxpacker) 4.3 on PHP 8.4 via [../boxpacker-run.php](../boxpacker-run.php). The ungrouped ITM-002 can share a box with any group, so it packs alongside GROUP-A; GROUP-B packs separately.

## Box candidates (in)

| Reference | Width | Length | Depth | Max Weight (kg) | Box Weight (kg) | Limit |
|-----------|------:|-------:|------:|----------------:|----------------:|-------|
| SML | 150 | 150 | 150 | 8.5 | 0.5 | max 100 |
| MED | 400 | 400 | 400 | 15.2 | 0.75 | — |
| LRG | 1200 | 1200 | 1200 | — | — | inactive |

Dimensions in millimetres.

## Items (in)

| ItemCode | ItemReference | Width | Length | Depth | Weight (kg) | Quantity | BoxGroup |
|----------|---------------|------:|-------:|------:|------------:|---------:|----------|
| ITM-001 | Widget A | 100 | 200 | 50 | 1 | 1 | GROUP-A |
| ITM-002 | Widget B | 300 | 150 | 75 | 2.8 | 1 | — |
| ITM-003 | Fragile Glassware | 80 | 80 | 120 | 0.82 | 1 | GROUP-B |

3 item types, 3 units total.

## Packed boxes (out)

| Box | Group | Type | Items | Utilisation | Gross (kg) | Contents |
|----:|-------|------|------:|------------:|-----------:|----------|
| 1 | GROUP-A + ungrouped | MED | 2 | 6.8% | 4.55 | 1× ITM-002, 1× ITM-001 |
| 2 | GROUP-B | SML | 1 | 22.8% | 1.32 | 1× ITM-003 |

2 boxes used, 3 of 3 units packed, nothing left over. ITM-001 needs a MED despite its small volume (its 200mm side exceeds SML's 150mm). The inactive LRG box is never used.
