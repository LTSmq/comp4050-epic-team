use crate::models::{AnchorPoint, BoxType, Item, PackedBox, PlacedItem};
use std::collections::{HashMap, HashSet};

pub struct Solver {
    available_box_types: Vec<BoxType>,
}

impl Solver {
    pub fn new(box_types: Vec<BoxType>) -> Self {
        // Keep active boxes and sort ascending by volume (smallest container first)
        let mut available: Vec<BoxType> = box_types.into_iter().filter(|b| b.active).collect();
        available.sort_by_key(|b| b.volume_cm3());
        Self {
            available_box_types: available,
        }
    }

    pub fn pack(&self, items: Vec<Item>) -> Result<Vec<PackedBox>, String> {
        // Best-Fit Decreasing: sort items descending by volume, then weight
        let mut unpacked_items = items;
        unpacked_items.sort_by(|a, b| {
            b.volume_cm3()
                .cmp(&a.volume_cm3())
                .then_with(|| b.weight.partial_cmp(&a.weight).unwrap_or(std::cmp::Ordering::Equal))
        });

        let mut packed_boxes: Vec<PackedBox> = Vec::new();
        let mut box_usage_counts: HashMap<String, usize> = HashMap::new();

        while !unpacked_items.is_empty() {
            let mut packed_any = false;

            for box_type in &self.available_box_types {
                // Enforce MaximumBoxes supply limit
                let count = box_usage_counts.entry(box_type.reference.clone()).or_insert(0);
                if let Some(max) = box_type.maximum_boxes {
                    if *count >= max {
                        continue;
                    }
                }

                let mut candidate_box = PackedBox::new(box_type.clone());
                let mut remaining_items = Vec::new();
                let mut anchor_points: Vec<AnchorPoint> = vec![AnchorPoint { x: 0, y: 0, z: 0 }];

                for item in unpacked_items.drain(..) {
                    if let Some(placement) = self.try_place_item(&item, &candidate_box, &anchor_points) {
                        candidate_box.placed_items.push(placement.clone());

                        // Generate new anchor points at the 3 exposed faces
                        let mut point_set: HashSet<AnchorPoint> = anchor_points.into_iter().collect();
                        point_set.insert(AnchorPoint {
                            x: placement.x + placement.width,
                            y: placement.y,
                            z: placement.z,
                        });
                        point_set.insert(AnchorPoint {
                            x: placement.x,
                            y: placement.y + placement.length,
                            z: placement.z,
                        });
                        point_set.insert(AnchorPoint {
                            x: placement.x,
                            y: placement.y,
                            z: placement.z + placement.depth,
                        });

                        // Gravity sort: prioritize lowest Z, then lowest Y, then lowest X
                        let mut sorted_points: Vec<AnchorPoint> = point_set.into_iter().collect();
                        sorted_points.sort_by_key(|p| (p.z, p.y, p.x));
                        anchor_points = sorted_points;
                    } else {
                        remaining_items.push(item);
                    }
                }

                if !candidate_box.placed_items.is_empty() {
                    *box_usage_counts.get_mut(&box_type.reference).unwrap() += 1;
                    packed_boxes.push(candidate_box);
                    unpacked_items = remaining_items;
                    packed_any = true;
                    break;
                } else {
                    unpacked_items = remaining_items;
                }
            }

            if !packed_any {
                return Err(format!(
                    "Could not pack item {} ({}). Exceeds dimensional boundaries or weight limits.",
                    unpacked_items[0].item_code, unpacked_items[0].item_reference
                ));
            }
        }

        Ok(packed_boxes)
    }

    fn try_place_item(
        &self,
        item: &Item,
        packed_box: &PackedBox,
        anchor_points: &[AnchorPoint],
    ) -> Option<PlacedItem> {
        // 1. Weight Constraint
        if let Some(max_weight) = packed_box.box_type.max_weight {
            if packed_box.current_items_weight() + item.weight > max_weight {
                return None;
            }
        }

        // 2. BoxGroup Isolation Constraint
        let current_group = packed_box.assigned_box_group();
        if let (Some(cg), Some(ig)) = (current_group, &item.box_group) {
            if cg != *ig {
                return None;
            }
        }

        // 3. 3D Orthogonal Rotations
        let orientations = [
            (item.width, item.length, item.depth),
            (item.width, item.depth, item.length),
            (item.length, item.width, item.depth),
            (item.length, item.depth, item.width),
            (item.depth, item.width, item.length),
            (item.depth, item.length, item.width),
        ];

        for pt in anchor_points {
            let (px, py, pz) = (pt.x, pt.y, pt.z);

            for &(w, l, d) in &orientations {
                // Boundary check
                if px + w <= packed_box.box_type.width
                    && py + l <= packed_box.box_type.length
                    && pz + d <= packed_box.box_type.depth
                {
                    // Overlap collision check
                    let collides = packed_box
                        .placed_items
                        .iter()
                        .any(|p| p.collides_with(px, py, pz, w, l, d));

                    if !collides {
                        return Some(PlacedItem {
                            item: item.clone(),
                            x: px,
                            y: py,
                            z: pz,
                            width: w,
                            length: l,
                            depth: d,
                        });
                    }
                }
            }
        }

        None
    }
}