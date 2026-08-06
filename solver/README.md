# Solver Team Overview

The solver team is responsible for the core optimisation engine of Project Perfect Fit. At a high level, the engine takes two JSON inputs, carton specifications (dimensions, max weight) and item specifications (dimensions, type/class), and determines the optimal way to pack those items into cartons.

All items are assumed to be rectangular. A key constraint is item compatibility: certain items cannot be packed together (eg dangerous goods with general freight), so the engine must classify items and group them into valid packable sets before attempting to arrange them.

Porposed Layers to the engine:

1. **Input:** Receives carton and item data as JSON (Need to double check this)
2. **Classification & Grouping:** Tags items by type and partitions them into compatible groups
3. **Constraint:** Applies compatibility rules (dangerous goods, fragility) and spatial constraints (weight limits, stacking)
4. **Optimisation:** Selects appropriate carton sizes and runs the 3D bin-packing algorithm to determine item placement
5. **Output:** Returns a packing solution (item positions, carton assignments) and an optional utilisation report