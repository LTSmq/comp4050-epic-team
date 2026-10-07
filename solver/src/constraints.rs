// Checks the packer runs on a candidate item and space before it commits a
// placement. They hold no state and make no placement decisions.
//
// MaxWeight is treated as a gross limit here: the items plus the container's
// own TareWeight must not exceed it. So a carton with a MaxWeight of 8.5 kg
// and a TareWeight of 0.5 kg takes at most 8.0 kg of items.

use crate::types::{Item, PackedContainer, Space};

// Slack (kg) on the weight limit, so adding up many f32 weights cannot reject
// a container that is exactly at its limit. 0.1 g is well below any weight
// the engine deals with.
//
// Public because solver.rs applies the same gross-weight rule against
// models::PackedBox; both paths must use one number or they can disagree at
// the limit.
pub const WEIGHT_TOLERANCE_KG: f32 = 1e-4;

/// Whether the item fits inside the free space, in the orientation its
/// dimensions are already in. Rotating the item is the packer's job: to test a
/// rotated orientation, call Space::fits with the swapped dimensions.
pub fn fits_in_space(item: &Item, space: &Space) -> bool {
    space.fits(item.width, item.length, item.depth)
}

/// Whether the item can be added without going over the container's weight
/// limit. Compares against the gross weight (items plus tare). A container
/// with no MaxWeight is unlimited.
pub fn weight_allowed(packed: &PackedContainer, item: &Item) -> bool {
    match packed.container.max_weight {
        Some(max_weight) => packed.gross_weight() + item.weight <= max_weight + WEIGHT_TOLERANCE_KG,
        None => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Container, Placement};

    fn item(width: u32, length: u32, depth: u32, weight: f32) -> Item {
        Item {
            item_code: "ITM-001".to_string(),
            item_reference: "Widget".to_string(),
            width,
            length,
            depth,
            weight,
            compatibility_group: None,
        }
    }

    fn space(width: u32, length: u32, depth: u32) -> Space {
        Space {
            x: 0,
            y: 0,
            z: 0,
            width,
            length,
            depth,
        }
    }

    fn container(max_weight: Option<f32>, tare_weight: Option<f32>) -> Container {
        Container {
            reference: "SML".to_string(),
            width: 150,
            length: 150,
            depth: 150,
            max_weight,
            tare_weight,
            active: true,
            max_containers: None,
        }
    }

    // A container holding one item of the given weight.
    fn packed_with(max_weight: Option<f32>, tare_weight: Option<f32>, held: f32) -> PackedContainer {
        let mut packed = PackedContainer::new(container(max_weight, tare_weight));
        packed.placements.push(Placement {
            item: item(10, 10, 10, held),
            x: 0,
            y: 0,
            z: 0,
            width: 10,
            length: 10,
            depth: 10,
        });
        packed
    }

    #[test]
    fn fits_when_smaller_than_space() {
        assert!(fits_in_space(&item(50, 100, 25, 1.0), &space(100, 200, 50)));
    }

    #[test]
    fn fits_when_exactly_filling_space() {
        assert!(fits_in_space(&item(100, 200, 50, 1.0), &space(100, 200, 50)));
    }

    #[test]
    fn does_not_fit_when_any_dimension_exceeds_space() {
        let free = space(100, 200, 50);
        assert!(!fits_in_space(&item(101, 200, 50, 1.0), &free));
        assert!(!fits_in_space(&item(100, 201, 50, 1.0), &free));
        assert!(!fits_in_space(&item(100, 200, 51, 1.0), &free));
    }

    #[test]
    fn does_not_rotate_the_item_to_make_it_fit() {
        // 200x100x50 only fits a 100x200x50 space if width and length are
        // swapped, and swapping them is the packer's job, not this check's.
        assert!(!fits_in_space(&item(200, 100, 50, 1.0), &space(100, 200, 50)));
    }

    #[test]
    fn weight_unlimited_when_no_max_weight() {
        let packed = packed_with(None, Some(0.5), 100.0);
        assert!(weight_allowed(&packed, &item(10, 10, 10, 1_000.0)));
    }

    #[test]
    fn weight_allowed_under_limit() {
        let packed = packed_with(Some(8.5), Some(0.5), 4.0);
        assert!(weight_allowed(&packed, &item(10, 10, 10, 2.0)));
    }

    #[test]
    fn weight_allowed_exactly_at_limit() {
        // 0.5 tare + 4.0 held + 4.0 added = 8.5, the stated maximum.
        let packed = packed_with(Some(8.5), Some(0.5), 4.0);
        assert!(weight_allowed(&packed, &item(10, 10, 10, 4.0)));
    }

    #[test]
    fn weight_rejected_over_limit() {
        let packed = packed_with(Some(8.5), Some(0.5), 4.0);
        assert!(!weight_allowed(&packed, &item(10, 10, 10, 4.1)));
    }

    #[test]
    fn weight_counts_the_tare_weight() {
        // An 8.4 kg item must not go into an 8.5 kg carton whose own tare is
        // 0.5 kg, because that carton would ship at 8.9 kg.
        let empty = PackedContainer::new(container(Some(8.5), Some(0.5)));
        assert!(!weight_allowed(&empty, &item(10, 10, 10, 8.4)));
        assert!(weight_allowed(&empty, &item(10, 10, 10, 8.0)));
    }

    #[test]
    fn weight_treats_missing_tare_as_zero() {
        let empty = PackedContainer::new(container(Some(8.5), None));
        assert!(weight_allowed(&empty, &item(10, 10, 10, 8.5)));
        assert!(!weight_allowed(&empty, &item(10, 10, 10, 8.6)));
    }

    #[test]
    fn weight_accumulation_does_not_drift_past_the_limit() {
        // 0.1 cannot be stored exactly as an f32, so adding it up ten times
        // drifts. A tenth 0.1 should still be allowed under a 1.0 limit.
        let mut packed = PackedContainer::new(container(Some(1.0), None));
        for _ in 0..9 {
            packed.placements.push(Placement {
                item: item(10, 10, 10, 0.1),
                x: 0,
                y: 0,
                z: 0,
                width: 10,
                length: 10,
                depth: 10,
            });
        }
        assert!(weight_allowed(&packed, &item(10, 10, 10, 0.1)));
    }
}
