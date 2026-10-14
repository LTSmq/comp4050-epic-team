use std::collections::HashMap;

use solver::types::{Container, Item, Orientation, Placement};
use solver::{Packer, PackingSolution};

const WEIGHT_TOLERANCE_KG: f32 = 1e-4;
const MIN_SUPPORT_RATIO: f64 = 0.8;
const GENERAL_GROUP: &str = "__GENERAL__";

fn validate_solution(
    original_items: &[Item],
    available_containers: &[Container],
    solution: &PackingSolution,
) -> Result<(), String> {
    // ---------------------------------------------------------------------
    // 1. Every input item must appear exactly once:
    //    either packed or explicitly reported as unpacked.
    // ---------------------------------------------------------------------

    let mut expected: HashMap<String, usize> = HashMap::new();

    for item in original_items {
        *expected.entry(item.item_code.clone()).or_insert(0) += 1;
    }

    let mut actual: HashMap<String, usize> = HashMap::new();

    for packed in &solution.containers {
        for placement in &packed.placements {
            *actual.entry(placement.item.item_code.clone()).or_insert(0) += 1;
        }
    }

    for unpacked in &solution.unpacked {
        *actual.entry(unpacked.item.item_code.clone()).or_insert(0) += 1;
    }

    if expected != actual {
        return Err(format!(
            "item conservation failed: expected {:?}, got {:?}",
            expected, actual
        ));
    }

    // Track carton supply independently.
    let mut opened_by_type: HashMap<String, usize> = HashMap::new();

    for packed in &solution.containers {
        let container = available_containers
            .iter()
            .find(|candidate| candidate.reference == packed.container.reference)
            .ok_or_else(|| {
                format!(
                    "solution used unknown container '{}'",
                    packed.container.reference
                )
            })?;

        if !container.active {
            return Err(format!(
                "solution used inactive container '{}'",
                container.reference
            ));
        }

        *opened_by_type
            .entry(container.reference.clone())
            .or_insert(0) += 1;

        // -----------------------------------------------------------------
        // 2. Gross carton weight must remain within MaxWeight.
        // -----------------------------------------------------------------

        let item_weight: f32 = packed
            .placements
            .iter()
            .map(|placement| placement.item.weight)
            .sum();

        let gross_weight = item_weight + container.tare_weight.unwrap_or(0.0);

        if let Some(max_weight) = container.max_weight {
            if gross_weight > max_weight + WEIGHT_TOLERANCE_KG {
                return Err(format!(
                    "container '{}' weighs {} kg but maximum is {} kg",
                    container.reference, gross_weight, max_weight
                ));
            }
        }

        // -----------------------------------------------------------------
        // 3. Under strict BoxGroup isolation, everything in one carton must
        //    belong to the same effective compatibility group.
        // -----------------------------------------------------------------

        if let Some(first) = packed.placements.first() {
            let first_group = first
                .item
                .compatibility_group
                .as_deref()
                .unwrap_or(GENERAL_GROUP);

            for placement in &packed.placements {
                let group = placement
                    .item
                    .compatibility_group
                    .as_deref()
                    .unwrap_or(GENERAL_GROUP);

                if group != first_group {
                    return Err(format!(
                        "container '{}' mixes compatibility groups '{}' and '{}'",
                        container.reference, first_group, group
                    ));
                }
            }
        }

        // -----------------------------------------------------------------
        // 4. Validate every individual placement.
        // -----------------------------------------------------------------

        for placement in &packed.placements {
            // Bounds.
            let x2 = placement.x as u64 + placement.width as u64;
            let y2 = placement.y as u64 + placement.length as u64;
            let z2 = placement.z as u64 + placement.depth as u64;

            if x2 > container.width as u64
                || y2 > container.length as u64
                || z2 > container.depth as u64
            {
                return Err(format!(
                    "item '{}' extends outside container '{}'",
                    placement.item.item_code, container.reference
                ));
            }

            // Rotation must be legal.
            if !is_legal_orientation(placement) {
                return Err(format!(
                    "item '{}' has illegal orientation {}x{}x{}",
                    placement.item.item_code, placement.width, placement.length, placement.depth
                ));
            }

            // Support.
            if placement.z > 0 {
                let base_area = placement.width as u64 * placement.length as u64;

                let supported_area: u64 = packed
                    .placements
                    .iter()
                    .filter(|support| support.z as u64 + support.depth as u64 == placement.z as u64)
                    .map(|support| xy_overlap_area(placement, support))
                    .sum();

                let support_ratio = supported_area as f64 / base_area as f64;

                if support_ratio + f64::EPSILON < MIN_SUPPORT_RATIO {
                    return Err(format!(
                        "item '{}' has only {:.1}% support",
                        placement.item.item_code,
                        support_ratio * 100.0
                    ));
                }
            }
        }

        // -----------------------------------------------------------------
        // 5. No two placed items may overlap.
        // -----------------------------------------------------------------

        for left in 0..packed.placements.len() {
            for right in (left + 1)..packed.placements.len() {
                let a = &packed.placements[left];
                let b = &packed.placements[right];

                if overlaps(a, b) {
                    return Err(format!(
                        "items '{}' and '{}' overlap in container '{}'",
                        a.item.item_code, b.item.item_code, container.reference
                    ));
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // 6. Carton supply limits.
    // ---------------------------------------------------------------------

    for container in available_containers {
        if let Some(limit) = container.max_containers {
            let used = opened_by_type
                .get(&container.reference)
                .copied()
                .unwrap_or(0);

            if used > limit {
                return Err(format!(
                    "container '{}' used {} times but supply limit is {}",
                    container.reference, used, limit
                ));
            }
        }
    }

    Ok(())
}

fn is_legal_orientation(placement: &Placement) -> bool {
    let item = &placement.item;

    let placed = (placement.width, placement.length, placement.depth);

    match item.orientation {
        Orientation::Any => {
            let legal = [
                (item.width, item.length, item.depth),
                (item.width, item.depth, item.length),
                (item.length, item.width, item.depth),
                (item.length, item.depth, item.width),
                (item.depth, item.width, item.length),
                (item.depth, item.length, item.width),
            ];

            legal.contains(&placed)
        }

        Orientation::ThisWayUp => {
            placed == (item.width, item.length, item.depth)
                || placed == (item.length, item.width, item.depth)
        }
    }
}

fn overlaps(a: &Placement, b: &Placement) -> bool {
    let ax2 = a.x as u64 + a.width as u64;
    let ay2 = a.y as u64 + a.length as u64;
    let az2 = a.z as u64 + a.depth as u64;

    let bx2 = b.x as u64 + b.width as u64;
    let by2 = b.y as u64 + b.length as u64;
    let bz2 = b.z as u64 + b.depth as u64;

    (a.x as u64) < bx2
        && (b.x as u64) < ax2
        && (a.y as u64) < by2
        && (b.y as u64) < ay2
        && (a.z as u64) < bz2
        && (b.z as u64) < az2
}

fn xy_overlap_area(a: &Placement, b: &Placement) -> u64 {
    let ax2 = a.x as u64 + a.width as u64;
    let ay2 = a.y as u64 + a.length as u64;

    let bx2 = b.x as u64 + b.width as u64;
    let by2 = b.y as u64 + b.length as u64;

    let width = ax2.min(bx2).saturating_sub((a.x as u64).max(b.x as u64));

    let length = ay2.min(by2).saturating_sub((a.y as u64).max(b.y as u64));

    width * length
}

fn container(reference: &str, width: u32, length: u32, depth: u32, max_weight: f32) -> Container {
    Container {
        reference: reference.to_string(),
        width,
        length,
        depth,
        max_weight: Some(max_weight),
        tare_weight: Some(0.5),
        active: true,
        max_containers: Some(20),
    }
}

fn item(
    code: String,
    width: u32,
    length: u32,
    depth: u32,
    weight: f32,
    group: Option<String>,
    orientation: Orientation,
) -> Item {
    Item {
        item_code: code.clone(),
        item_reference: code,
        width,
        length,
        depth,
        weight,
        compatibility_group: group,
        fragile: false,
        max_load_kg: None,
        orientation,
    }
}

#[test]
fn independently_validates_known_exact_pack() {
    let containers = vec![container("SML", 150, 150, 150, 10.0)];

    let items: Vec<Item> = (1..=8)
        .map(|index| {
            item(
                format!("CUBE-{index}"),
                75,
                75,
                75,
                0.25,
                None,
                Orientation::Any,
            )
        })
        .collect();

    let solution = Packer::new(containers.clone())
        .pack(items.clone())
        .expect("packing should succeed");

    assert!(solution.is_complete());
    assert_eq!(solution.container_count(), 1);

    validate_solution(&items, &containers, &solution)
        .expect("independent solution validation failed");
}

// Small deterministic pseudo-random generator so this test does not require
// adding another Cargo dependency.
struct Lcg(u64);

impl Lcg {
    fn new(seed: u64) -> Self {
        Self(seed)
    }

    fn next_u32(&mut self) -> u32 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1);

        (self.0 >> 32) as u32
    }

    fn range(&mut self, min: u32, max: u32) -> u32 {
        min + self.next_u32() % (max - min + 1)
    }
}

#[test]
fn randomized_packings_preserve_core_invariants() {
    let containers = vec![
        container("SML", 180, 180, 180, 10.0),
        container("MED", 350, 350, 350, 25.0),
        container("LRG", 600, 450, 400, 40.0),
    ];

    let mut rng = Lcg::new(0x5045_5246_4543_5446);

    for case in 0..250 {
        let count = rng.range(1, 30);

        let mut items = Vec::new();

        for index in 0..count {
            let group = match rng.range(0, 2) {
                0 => None,
                1 => Some("GROUP-A".to_string()),
                _ => Some("GROUP-B".to_string()),
            };

            let orientation = if rng.range(0, 4) == 0 {
                Orientation::ThisWayUp
            } else {
                Orientation::Any
            };

            items.push(item(
                format!("CASE-{case}-ITEM-{index}"),
                rng.range(20, 500),
                rng.range(20, 500),
                rng.range(20, 350),
                rng.range(100, 6_000) as f32 / 1_000.0,
                group,
                orientation,
            ));
        }

        let solution = Packer::new(containers.clone())
            .pack(items.clone())
            .unwrap_or_else(|error| panic!("case {case}: packer error: {error}"));

        validate_solution(&items, &containers, &solution)
            .unwrap_or_else(|error| panic!("case {case}: invalid solution: {error}"));
    }
}
