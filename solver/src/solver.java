import java.util.*;


// Diverges from solver.rs: height-first anchor sort, plus pre-checks/pruning for speed.
class Solver {

    static final float WEIGHT_TOLERANCE_KG = 1e-4f;

    //MODELS

    static class Item {
        String itemCode;
        String itemReference;
        long width, length, depth;
        float weight;
        String boxGroup; // null == None

        Item(String itemCode, String itemReference, long width, long length, long depth,
             float weight, String boxGroup) {
            this.itemCode = itemCode;
            this.itemReference = itemReference;
            this.width = width;
            this.length = length;
            this.depth = depth;
            this.weight = weight;
            this.boxGroup = boxGroup;
        }

        long volumeCm3() {
            return (width * length * depth) / 1_000;
        }
    }

    static class AnchorPoint {
        long x, y, z;

        AnchorPoint(long x, long y, long z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof AnchorPoint)) return false;
            AnchorPoint p = (AnchorPoint) o;
            return x == p.x && y == p.y && z == p.z;
        }

        @Override
        public int hashCode() {
            return Objects.hash(x, y, z);
        }
    }

    static class BoxType {
        String reference;
        long width, length, depth;
        Float maxWeight;   // null == None
        Float boxWeight;   // null == None
        boolean active;
        Integer maximumBoxes; // null == None

        BoxType(String reference, long width, long length, long depth,
                Float maxWeight, Float boxWeight, boolean active, Integer maximumBoxes) {
            this.reference = reference;
            this.width = width;
            this.length = length;
            this.depth = depth;
            this.maxWeight = maxWeight;
            this.boxWeight = boxWeight;
            this.active = active;
            this.maximumBoxes = maximumBoxes;
        }

        long volumeCm3() {
            return (width * length * depth) / 1_000;
        }
    }

    static class PlacedItem {
        Item item;
        long x, y, z;
        long width, length, depth;

        PlacedItem(Item item, long x, long y, long z, long width, long length, long depth) {
            this.item = item;
            this.x = x;
            this.y = y;
            this.z = z;
            this.width = width;
            this.length = length;
            this.depth = depth;
        }

        // 3D Axis-Aligned Bounding Box (AABB) intersection check
        boolean collidesWith(long ox, long oy, long oz, long ow, long ol, long od) {
            return !(x + width <= ox
                    || ox + ow <= x
                    || y + length <= oy
                    || oy + ol <= y
                    || z + depth <= oz
                    || oz + od <= z);
        }

        // True if p is inside this item's footprint (half-open, so the near face counts too).
        boolean encloses(AnchorPoint p) {
            return p.x >= x && p.x < x + width
                    && p.y >= y && p.y < y + length
                    && p.z >= z && p.z < z + depth;
        }
    }

    static class PackedBox {
        int boxIndex;
        BoxType boxType;
        List<PlacedItem> placedItems = new ArrayList<>();
        private long usedVolume = 0;
        private float usedWeight = 0f;

        PackedBox(int boxIndex, BoxType boxType) {
            this.boxIndex = boxIndex;
            this.boxType = boxType;
        }

        // Adds the item and keeps running volume/weight totals so callers
        // don't have to re-sum placedItems on every check.
        void addItem(PlacedItem p) {
            placedItems.add(p);
            usedVolume += (p.width * p.length * p.depth) / 1_000;
            usedWeight += p.item.weight;
        }

        long remainingVolumeCm3() {
            return boxType.volumeCm3() - usedVolume;
        }

        float currentItemsWeight() {
            return usedWeight;
        }

        float grossWeight() {
            return usedWeight + (boxType.boxWeight != null ? boxType.boxWeight : 0f);
        }

        // Returns the box group assigned to the box, if any item carries one
        String assignedBoxGroup() {
            for (PlacedItem p : placedItems) {
                if (p.item.boxGroup != null) return p.item.boxGroup;
            }
            return null;
        }
    }

    //SOLVER

    private final List<BoxType> availableBoxTypes;

    Solver(List<BoxType> boxTypes) {
        // Keep active boxes and sort ascending by volume (smallest container first)
        List<BoxType> available = new ArrayList<>();
        for (BoxType b : boxTypes) {
            if (b.active) available.add(b);
        }
        available.sort(Comparator.comparingLong(BoxType::volumeCm3));
        this.availableBoxTypes = available;
    }

    List<PackedBox> pack(List<Item> items) {
        // Best-Fit Decreasing: sort items descending by volume, then weight
        List<Item> unpackedItems = new ArrayList<>(items);
        unpackedItems.sort((a, b) -> {
            int cmp = Long.compare(b.volumeCm3(), a.volumeCm3());
            if (cmp != 0) return cmp;
            return Float.compare(b.weight, a.weight);
        });

        List<PackedBox> packedBoxes = new ArrayList<>();
        Map<String, Integer> boxUsageCounts = new HashMap<>();

        while (!unpackedItems.isEmpty()) {
            boolean packedAny = false;

            for (BoxType boxType : availableBoxTypes) {
                // Enforce MaximumBoxes supply limit
                int count = boxUsageCounts.getOrDefault(boxType.reference, 0);
                if (boxType.maximumBoxes != null && count >= boxType.maximumBoxes) {
                    continue;
                }

                PackedBox candidateBox = new PackedBox(packedBoxes.size(), boxType);
                List<Item> remainingItems = new ArrayList<>();
                List<AnchorPoint> anchorPoints = new ArrayList<>();
                anchorPoints.add(new AnchorPoint(0, 0, 0));

                for (Item item : unpackedItems) {
                    PlacedItem placement = tryPlaceItem(item, candidateBox, anchorPoints);
                    if (placement != null) {
                        candidateBox.addItem(placement);

                        // Generate new anchor points at the 3 exposed faces
                        Set<AnchorPoint> pointSet = new LinkedHashSet<>(anchorPoints);
                        pointSet.add(new AnchorPoint(
                                placement.x + placement.width, placement.y, placement.z));
                        pointSet.add(new AnchorPoint(
                                placement.x, placement.y + placement.length, placement.z));
                        pointSet.add(new AnchorPoint(
                                placement.x, placement.y, placement.z + placement.depth));

                        // Drop anchors now enclosed by a placed item - they can never be reused.
                        pointSet.removeIf(p -> isEnclosedByAny(p, candidateBox.placedItems));

                        // Height-first: sort by X, Y, Z so stack anchors (same x,y) win over floor spread.
                        List<AnchorPoint> sortedPoints = new ArrayList<>(pointSet);
                        sortedPoints.sort(Comparator
                                .comparingLong((AnchorPoint p) -> p.x)
                                .thenComparingLong(p -> p.y)
                                .thenComparingLong(p -> p.z));
                        anchorPoints = sortedPoints;
                    } else {
                        remainingItems.add(item);
                    }
                }

                if (!candidateBox.placedItems.isEmpty()) {
                    boxUsageCounts.put(boxType.reference, count + 1);
                    packedBoxes.add(candidateBox);
                    unpackedItems = remainingItems;
                    packedAny = true;
                    break;
                } else {
                    unpackedItems = remainingItems;
                }
            }

            if (!packedAny) {
                Item first = unpackedItems.get(0);
                throw new RuntimeException(String.format(
                        "Could not pack item %s (%s). Exceeds dimensional boundaries or weight limits.",
                        first.itemCode, first.itemReference));
            }
        }

        return packedBoxes;
    }

    private static boolean isEnclosedByAny(AnchorPoint p, List<PlacedItem> placedItems) {
        for (PlacedItem placed : placedItems) {
            if (placed.encloses(p)) return true;
        }
        return false;
    }

    // Necessary (not sufficient) check: do the item's dims fit the box's raw dims in some orientation?
    private static boolean fitsBoxDimensions(Item item, BoxType boxType) {
        long[] itemDims = {item.width, item.length, item.depth};
        long[] boxDims = {boxType.width, boxType.length, boxType.depth};
        Arrays.sort(itemDims);
        Arrays.sort(boxDims);
        return itemDims[0] <= boxDims[0] && itemDims[1] <= boxDims[1] && itemDims[2] <= boxDims[2];
    }

    // The 6 orthogonal orientations, deduped for items with equal dimensions (cubes, etc).
    private static List<long[]> uniqueOrientations(Item item) {
        long[][] all = {
                {item.width, item.length, item.depth},
                {item.width, item.depth, item.length},
                {item.length, item.width, item.depth},
                {item.length, item.depth, item.width},
                {item.depth, item.width, item.length},
                {item.depth, item.length, item.width},
        };
        List<long[]> unique = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (long[] o : all) {
            String key = o[0] + "," + o[1] + "," + o[2];
            if (seen.add(key)) unique.add(o);
        }
        return unique;
    }

    private PlacedItem tryPlaceItem(Item item, PackedBox packedBox, List<AnchorPoint> anchorPoints) {
        // 1. Weight Constraint
        // MaxWeight is a gross limit: the items plus the carton's own BoxWeight
        // must not exceed it.
        if (packedBox.boxType.maxWeight != null) {
            if (packedBox.grossWeight() + item.weight > packedBox.boxType.maxWeight + WEIGHT_TOLERANCE_KG) {
                return null;
            }
        }

        // 2. Cheap capacity/feasibility pre-checks, before touching anchors at all
        if (item.volumeCm3() > packedBox.remainingVolumeCm3()) {
            return null;
        }
        if (!fitsBoxDimensions(item, packedBox.boxType)) {
            return null;
        }

        // 3. BoxGroup Isolation Constraint
        String currentGroup = packedBox.assignedBoxGroup();
        if (currentGroup != null && item.boxGroup != null && !currentGroup.equals(item.boxGroup)) {
            return null;
        }

        // 4. 3D Orthogonal Rotations
        List<long[]> orientations = uniqueOrientations(item);

        for (AnchorPoint pt : anchorPoints) {
            long px = pt.x, py = pt.y, pz = pt.z;

            for (long[] o : orientations) {
                long w = o[0], l = o[1], d = o[2];

                // Boundary check
                if (px + w <= packedBox.boxType.width
                        && py + l <= packedBox.boxType.length
                        && pz + d <= packedBox.boxType.depth) {

                    // Overlap collision check
                    boolean collides = false;
                    for (PlacedItem p : packedBox.placedItems) {
                        if (p.collidesWith(px, py, pz, w, l, d)) {
                            collides = true;
                            break;
                        }
                    }

                    if (!collides) {
                        return new PlacedItem(item, px, py, pz, w, l, d);
                    }
                }
            }
        }

        return null;
    }
}
