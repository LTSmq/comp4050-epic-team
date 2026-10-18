# Generated order results

Solved against `http://127.0.0.1:9315/solve`.

## GEN-01-ecommerce-mix: PASS

| | |
| --- | --- |
| Units placed | 159 of 159 |
| Cartons | 10 (lower bound 8, by volume or weight) |
| Carton types used | LARGE x6, SMALL x1, XL x3 |
| Average fill | 68% |
| Solve time | 64 ms |
| Unpacked | none |
| Expected to be unpackable | none |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | LARGE | 33 | 91% | 29.0 / 30.0 kg | (untagged) |
| 1 | SMALL | 17 | 84% | 8.1 / 12.0 kg | (untagged) |
| 2 | XL | 8 | 67% | 39.9 / 40.0 kg | (untagged) |
| 3 | LARGE | 25 | 80% | 23.2 / 30.0 kg | (untagged) |
| 4 | LARGE | 16 | 75% | 29.5 / 30.0 kg | (untagged) |
| 5 | LARGE | 18 | 76% | 29.9 / 30.0 kg | (untagged) |
| 6 | LARGE | 13 | 70% | 30.0 / 30.0 kg | (untagged) |
| 7 | XL | 10 | 53% | 39.2 / 40.0 kg | (untagged) |
| 8 | XL | 10 | 35% | 38.4 / 40.0 kg | (untagged) |
| 9 | LARGE | 9 | 53% | 26.7 / 30.0 kg | (untagged) |

## GEN-02-grouped-goods: PASS

| | |
| --- | --- |
| Units placed | 153 of 153 |
| Cartons | 15 (lower bound 13, by volume or weight) |
| Carton types used | LARGE x2, MEDIUM x1, SMALL x1, XL x11 |
| Average fill | 26% |
| Solve time | 138 ms |
| Unpacked | none |
| Expected to be unpackable | none |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | XL | 4 | 19% | 37.4 / 40.0 kg | CHILLED |
| 1 | XL | 5 | 18% | 39.2 / 40.0 kg | CHILLED |
| 2 | XL | 6 | 15% | 39.9 / 40.0 kg | CHILLED |
| 3 | XL | 7 | 16% | 37.5 / 40.0 kg | CHILLED |
| 4 | SMALL | 2 | 43% | 6.2 / 12.0 kg | CHILLED |
| 5 | XL | 11 | 40% | 39.8 / 40.0 kg | (untagged) |
| 6 | XL | 14 | 34% | 39.7 / 40.0 kg | (untagged) |
| 7 | LARGE | 18 | 53% | 27.9 / 30.0 kg | (untagged) |
| 8 | XL | 7 | 18% | 39.4 / 40.0 kg | HAZMAT |
| 9 | XL | 8 | 12% | 39.4 / 40.0 kg | HAZMAT |
| 10 | XL | 14 | 14% | 39.4 / 40.0 kg | HAZMAT |
| 11 | LARGE | 8 | 17% | 23.9 / 30.0 kg | HAZMAT |
| 12 | XL | 13 | 21% | 39.8 / 40.0 kg | FOOD |
| 13 | XL | 20 | 23% | 39.8 / 40.0 kg | FOOD |
| 14 | MEDIUM | 16 | 42% | 15.9 / 20.0 kg | FOOD |

## GEN-03-awkward-geometry: PASS

| | |
| --- | --- |
| Units placed | 101 of 101 |
| Cartons | 15 (lower bound 5, by volume or weight) |
| Carton types used | CRATE x4, FLAT x5, TUBE x6 |
| Average fill | 72% |
| Solve time | 69 ms |
| Unpacked | none |
| Expected to be unpackable | none |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | CRATE | 7 | 50% | 35.0 / 35.0 kg | (untagged) |
| 1 | CRATE | 21 | 72% | 35.0 / 35.0 kg | (untagged) |
| 2 | CRATE | 52 | 81% | 28.1 / 35.0 kg | (untagged) |
| 3 | CRATE | 2 | 40% | 10.0 / 35.0 kg | (untagged) |
| 4 | FLAT | 1 | 80% | 6.5 / 10.0 kg | (untagged) |
| 5 | FLAT | 1 | 80% | 6.5 / 10.0 kg | (untagged) |
| 6 | FLAT | 1 | 80% | 6.5 / 10.0 kg | (untagged) |
| 7 | FLAT | 3 | 93% | 9.5 / 10.0 kg | (untagged) |
| 8 | FLAT | 3 | 93% | 9.5 / 10.0 kg | (untagged) |
| 9 | TUBE | 1 | 79% | 0.7 / 6.0 kg | (untagged) |
| 10 | TUBE | 1 | 79% | 0.7 / 6.0 kg | (untagged) |
| 11 | TUBE | 1 | 79% | 0.7 / 6.0 kg | (untagged) |
| 12 | TUBE | 1 | 79% | 0.7 / 6.0 kg | (untagged) |
| 13 | TUBE | 4 | 61% | 5.1 / 6.0 kg | (untagged) |
| 14 | TUBE | 2 | 30% | 2.7 / 6.0 kg | (untagged) |

## GEN-04-heavy-freight: PASS

| | |
| --- | --- |
| Units placed | 58 of 59 |
| Cartons | 16 (lower bound 15, by volume or weight) |
| Carton types used | HD-LARGE x15, HD-SMALL x1 |
| Average fill | 17% |
| Solve time | 11 ms |
| Unpacked | ANVIL-29 x1 |
| Expected to be unpackable | ANVIL-29 |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | HD-LARGE | 2 | 3% | 30.0 / 30.0 kg | (untagged) |
| 1 | HD-LARGE | 2 | 3% | 30.0 / 30.0 kg | (untagged) |
| 2 | HD-LARGE | 3 | 36% | 29.5 / 30.0 kg | (untagged) |
| 3 | HD-LARGE | 4 | 33% | 30.0 / 30.0 kg | (untagged) |
| 4 | HD-LARGE | 3 | 28% | 29.0 / 30.0 kg | (untagged) |
| 5 | HD-LARGE | 3 | 22% | 29.0 / 30.0 kg | (untagged) |
| 6 | HD-LARGE | 4 | 26% | 28.8 / 30.0 kg | (untagged) |
| 7 | HD-LARGE | 5 | 30% | 28.8 / 30.0 kg | (untagged) |
| 8 | HD-LARGE | 5 | 29% | 27.9 / 30.0 kg | (untagged) |
| 9 | HD-LARGE | 7 | 25% | 29.8 / 30.0 kg | (untagged) |
| 10 | HD-LARGE | 8 | 11% | 27.6 / 30.0 kg | (untagged) |
| 11 | HD-LARGE | 8 | 11% | 27.6 / 30.0 kg | (untagged) |
| 12 | HD-SMALL | 1 | 5% | 4.2 / 15.0 kg | (untagged) |
| 13 | HD-LARGE | 1 | 1% | 30.0 / 30.0 kg | (untagged) |
| 14 | HD-LARGE | 1 | 1% | 30.0 / 30.0 kg | (untagged) |
| 15 | HD-LARGE | 1 | 1% | 30.0 / 30.0 kg | (untagged) |

## GEN-05-bulk-small: PASS

| | |
| --- | --- |
| Units placed | 550 of 550 |
| Cartons | 5 (lower bound 5, by volume or weight) |
| Carton types used | BIN x4, TOTE x1 |
| Average fill | 61% |
| Solve time | 2058 ms |
| Unpacked | none |
| Expected to be unpackable | none |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | BIN | 82 | 53% | 24.9 / 25.0 kg | (untagged) |
| 1 | BIN | 94 | 56% | 25.0 / 25.0 kg | (untagged) |
| 2 | BIN | 180 | 70% | 25.0 / 25.0 kg | (untagged) |
| 3 | BIN | 119 | 51% | 25.0 / 25.0 kg | (untagged) |
| 4 | TOTE | 75 | 77% | 10.0 / 18.0 kg | (untagged) |

## GEN-06-partial-and-supply: PASS

| | |
| --- | --- |
| Units placed | 85 of 87 |
| Cartons | 8 (lower bound 5, by volume or weight) |
| Carton types used | BIG x2, MED x4, SML x2 |
| Average fill | 62% |
| Solve time | 17 ms |
| Unpacked | SAFE-30 x1, SOFA-1400 x1 |
| Expected to be unpackable | SAFE-30, SOFA-1400 |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | BIG | 16 | 77% | 24.9 / 25.0 kg | (untagged) |
| 1 | BIG | 10 | 32% | 24.9 / 25.0 kg | (untagged) |
| 2 | MED | 8 | 66% | 15.0 / 15.0 kg | (untagged) |
| 3 | MED | 10 | 62% | 14.7 / 15.0 kg | (untagged) |
| 4 | MED | 12 | 67% | 11.8 / 15.0 kg | (untagged) |
| 5 | MED | 18 | 71% | 14.6 / 15.0 kg | (untagged) |
| 6 | SML | 5 | 63% | 3.9 / 6.0 kg | (untagged) |
| 7 | SML | 6 | 63% | 3.1 / 6.0 kg | (untagged) |
