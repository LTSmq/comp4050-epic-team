# Generated order results

Solved against `http://localhost:8080/solve`.

## GEN-01-ecommerce-mix: PASS

| | |
| --- | --- |
| Units placed | 159 of 159 |
| Cartons | 10 (lower bound 8, by volume or weight) |
| Carton types used | LARGE x6, SMALL x1, XL x3 |
| Average fill | 68% |
| Solve time | 2127 ms |
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
| Solve time | 2223 ms |
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
| Solve time | 2118 ms |
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
| Solve time | 2050 ms |
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
| Solve time | 4253 ms |
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
| Solve time | 2093 ms |
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

## GEN-07-load_1000: PASS

| | |
| --- | --- |
| Units placed | 1000 of 1000 |
| Cartons | 11 (lower bound 10, by volume or weight) |
| Carton types used | BIN x11 |
| Average fill | 86% |
| Solve time | 4320 ms |
| Unpacked | none |
| Expected to be unpackable | none |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 1 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 2 | BIN | 84 | 93% | 9.6 / 25.0 kg | (untagged) |
| 3 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 4 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 5 | BIN | 76 | 87% | 8.8 / 25.0 kg | (untagged) |
| 6 | BIN | 77 | 84% | 8.9 / 25.0 kg | (untagged) |
| 7 | BIN | 89 | 94% | 10.1 / 25.0 kg | (untagged) |
| 8 | BIN | 104 | 82% | 11.6 / 25.0 kg | (untagged) |
| 9 | BIN | 133 | 73% | 14.5 / 25.0 kg | (untagged) |
| 10 | BIN | 111 | 42% | 12.3 / 25.0 kg | (untagged) |

## GEN-08-load_2500: PASS

| | |
| --- | --- |
| Units placed | 2500 of 2500 |
| Cartons | 26 (lower bound 24, by volume or weight) |
| Carton types used | BIN x26 |
| Average fill | 91% |
| Solve time | 7717 ms |
| Unpacked | none |
| Expected to be unpackable | none |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 1 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 2 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 3 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 4 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 5 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 6 | BIN | 85 | 94% | 9.7 / 25.0 kg | (untagged) |
| 7 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 8 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 9 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 10 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 11 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 12 | BIN | 75 | 96% | 8.7 / 25.0 kg | (untagged) |
| 13 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 14 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 15 | BIN | 74 | 88% | 8.6 / 25.0 kg | (untagged) |
| 16 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 17 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 18 | BIN | 90 | 94% | 10.2 / 25.0 kg | (untagged) |
| 19 | BIN | 104 | 84% | 11.6 / 25.0 kg | (untagged) |
| 20 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 21 | BIN | 112 | 84% | 12.4 / 25.0 kg | (untagged) |
| 22 | BIN | 142 | 91% | 15.4 / 25.0 kg | (untagged) |
| 23 | BIN | 181 | 83% | 19.3 / 25.0 kg | (untagged) |
| 24 | BIN | 199 | 80% | 21.1 / 25.0 kg | (untagged) |
| 25 | BIN | 109 | 39% | 12.1 / 25.0 kg | (untagged) |

## GEN-09-load_5000: PASS

| | |
| --- | --- |
| Units placed | 5000 of 5000 |
| Cartons | 51 (lower bound 48, by volume or weight) |
| Carton types used | BIN x51 |
| Average fill | 92% |
| Solve time | 15269 ms |
| Unpacked | none |
| Expected to be unpackable | none |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 1 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 2 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 3 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 4 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 5 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 6 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 7 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 8 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 9 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 10 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 11 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 12 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 13 | BIN | 82 | 93% | 9.4 / 25.0 kg | (untagged) |
| 14 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 15 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 16 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 17 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 18 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 19 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 20 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 21 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 22 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 23 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 24 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 25 | BIN | 75 | 94% | 8.7 / 25.0 kg | (untagged) |
| 26 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 27 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 28 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 29 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 30 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 31 | BIN | 73 | 85% | 8.5 / 25.0 kg | (untagged) |
| 32 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 33 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 34 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 35 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 36 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 37 | BIN | 89 | 89% | 10.1 / 25.0 kg | (untagged) |
| 38 | BIN | 93 | 81% | 10.5 / 25.0 kg | (untagged) |
| 39 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 40 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 41 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 42 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 43 | BIN | 110 | 76% | 12.2 / 25.0 kg | (untagged) |
| 44 | BIN | 141 | 93% | 15.3 / 25.0 kg | (untagged) |
| 45 | BIN | 142 | 88% | 15.4 / 25.0 kg | (untagged) |
| 46 | BIN | 185 | 87% | 19.7 / 25.0 kg | (untagged) |
| 47 | BIN | 210 | 94% | 22.2 / 25.0 kg | (untagged) |
| 48 | BIN | 209 | 90% | 22.1 / 25.0 kg | (untagged) |
| 49 | BIN | 238 | 85% | 25.0 / 25.0 kg | (untagged) |
| 50 | BIN | 156 | 56% | 16.8 / 25.0 kg | (untagged) |

## GEN-10-load_10000: PASS

| | |
| --- | --- |
| Units placed | 10000 of 10000 |
| Cartons | 101 (lower bound 95, by volume or weight) |
| Carton types used | BIN x101 |
| Average fill | 93% |
| Solve time | 38032 ms |
| Unpacked | none |
| Expected to be unpackable | none |

| # | Type | Units | Fill | Weight | Groups |
| --- | --- | --- | --- | --- | --- |
| 0 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 1 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 2 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 3 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 4 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 5 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 6 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 7 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 8 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 9 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 10 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 11 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 12 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 13 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 14 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 15 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 16 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 17 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 18 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 19 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 20 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 21 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 22 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 23 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 24 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 25 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 26 | BIN | 86 | 96% | 9.8 / 25.0 kg | (untagged) |
| 27 | BIN | 84 | 93% | 9.6 / 25.0 kg | (untagged) |
| 28 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 29 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 30 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 31 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 32 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 33 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 34 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 35 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 36 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 37 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 38 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 39 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 40 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 41 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 42 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 43 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 44 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 45 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 46 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 47 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 48 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 49 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 50 | BIN | 77 | 96% | 8.9 / 25.0 kg | (untagged) |
| 51 | BIN | 76 | 92% | 8.8 / 25.0 kg | (untagged) |
| 52 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 53 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 54 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 55 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 56 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 57 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 58 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 59 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 60 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 61 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 62 | BIN | 72 | 91% | 8.4 / 25.0 kg | (untagged) |
| 63 | BIN | 88 | 90% | 10.0 / 25.0 kg | (untagged) |
| 64 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 65 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 66 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 67 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 68 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 69 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 70 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 71 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 72 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 73 | BIN | 88 | 98% | 10.0 / 25.0 kg | (untagged) |
| 74 | BIN | 89 | 90% | 10.1 / 25.0 kg | (untagged) |
| 75 | BIN | 88 | 84% | 10.0 / 25.0 kg | (untagged) |
| 76 | BIN | 88 | 84% | 10.0 / 25.0 kg | (untagged) |
| 77 | BIN | 110 | 84% | 12.2 / 25.0 kg | (untagged) |
| 78 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 79 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 80 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 81 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 82 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 83 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 84 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 85 | BIN | 108 | 86% | 12.0 / 25.0 kg | (untagged) |
| 86 | BIN | 108 | 80% | 12.0 / 25.0 kg | (untagged) |
| 87 | BIN | 141 | 93% | 15.3 / 25.0 kg | (untagged) |
| 88 | BIN | 141 | 93% | 15.3 / 25.0 kg | (untagged) |
| 89 | BIN | 141 | 93% | 15.3 / 25.0 kg | (untagged) |
| 90 | BIN | 141 | 92% | 15.3 / 25.0 kg | (untagged) |
| 91 | BIN | 165 | 89% | 17.7 / 25.0 kg | (untagged) |
| 92 | BIN | 191 | 89% | 20.3 / 25.0 kg | (untagged) |
| 93 | BIN | 210 | 94% | 22.2 / 25.0 kg | (untagged) |
| 94 | BIN | 210 | 94% | 22.2 / 25.0 kg | (untagged) |
| 95 | BIN | 210 | 94% | 22.2 / 25.0 kg | (untagged) |
| 96 | BIN | 210 | 94% | 22.2 / 25.0 kg | (untagged) |
| 97 | BIN | 237 | 85% | 24.9 / 25.0 kg | (untagged) |
| 98 | BIN | 238 | 85% | 25.0 / 25.0 kg | (untagged) |
| 99 | BIN | 238 | 85% | 25.0 / 25.0 kg | (untagged) |
| 100 | BIN | 167 | 59% | 17.9 / 25.0 kg | (untagged) |
