//! Constraint layer for the Perfect Fit optimisation engine.
//!
//! This module owns every rule about *whether* a placement is legal. It deliberately
//! knows nothing about *how* candidate placements are generated -- that is `packer.rs`.
//! Splitting the two means a new search strategy inherits the rules for free, and a new
//! rule (a customer packing policy, a carrier restriction) can be added without touching
//! the search.
//!
//! Rules are evaluated at two levels:
//!
//! * **Admission** ([`ConstraintSet::check_admission`]) -- may this item go in this
//!   container at all? Compatibility and weight. Cheap, checked once per
//!   (container, item) pair.
//! * **Placement** ([`ConstraintSet::check_placement`]) -- may this item go in this
//!   specific position and orientation? Bounds, collision, support, load bearing.
//!   Checked once per candidate position.
//!
//! Coordinate convention, inherited from the MVP solver: `x` runs along the container's
//! width, `y` along its length, and `z` is vertical (mapped to the `depth` field). "Up"
//! therefore means increasing `z`.

use std::fmt;

use crate::types::{Item, PackedContainer, Placement, Space};

/// Group key applied to items that carry no explicit compatibility group.
///
/// Under [`CompatibilityPolicy::StrictIsolation`] this makes general freight a real
/// group rather than a wildcard, which is what stops dangerous goods being packed
/// alongside it.
pub const WEIGHT_TOLERANCE_KG: f32 = 1e-4;
pub const GENERAL_FREIGHT: &str = "__GENERAL__";

/// The compatibility group an item belongs to, substituting [`GENERAL_FREIGHT`] when
/// the item carries none.
pub fn group_key(item: &Item) -> &str {
    item.compatibility_group
        .as_deref()
        .unwrap_or(GENERAL_FREIGHT)
}

/// Why a placement or admission was refused.
///
/// Returned rather than a bare `bool` so the portal can explain *why* an order could not
/// be packed instead of just reporting that it could not.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Rejection {
    /// Adding the item would exceed the container's maximum weight.
    ContainerWeightExceeded,
    /// The item's compatibility group may not share a container with what is inside.
    IncompatibleGroup {
        container_group: String,
        item_group: String,
    },
    /// The item would protrude beyond the container walls.
    OutOfBounds,
    /// The item would overlap something already placed.
    Collision,
    /// Too little of the item's base rests on the floor or on the items below it.
    /// Ratios are in percent so the variant stays comparable.
    InsufficientSupport { required_pct: u32, actual_pct: u32 },
    /// An item underneath cannot bear the additional weight.
    LoadBearingExceeded { blocking_item: String },
    /// No candidate position was found anywhere in the container.
    NoFreeSpace,
}

impl fmt::Display for Rejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Rejection::ContainerWeightExceeded => {
                write!(f, "container weight limit would be exceeded")
            }
            Rejection::IncompatibleGroup {
                container_group,
                item_group,
            } => write!(
                f,
                "compatibility group '{}' may not share a container with '{}'",
                item_group, container_group
            ),
            Rejection::OutOfBounds => write!(f, "item would protrude beyond the container"),
            Rejection::Collision => write!(f, "item would overlap an item already placed"),
            Rejection::InsufficientSupport {
                required_pct,
                actual_pct,
            } => write!(
                f,
                "only {}% of the item's base would be supported, {}% required",
                actual_pct, required_pct
            ),
            Rejection::LoadBearingExceeded { blocking_item } => write!(
                f,
                "item '{}' underneath cannot bear the additional weight",
                blocking_item
            ),
            Rejection::NoFreeSpace => write!(f, "no free space large enough in this container"),
        }
    }
}

/// How compatibility groups are allowed to mix inside one container.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompatibilityPolicy {
    /// Every distinct group is isolated, and ungrouped items form their own group.
    ///
    /// This is the default, and the only policy that satisfies the brief's requirement
    /// that dangerous goods are never packed with general freight.
    StrictIsolation,
    /// Grouped items are isolated from each other, but ungrouped items may join any
    /// container. Reproduces the MVP solver's behaviour and is retained only for
    /// backwards comparison -- it permits hazardous goods to travel with general freight.
    UngroupedAreUniversal,
    /// Groups mix freely unless a pair is explicitly declared incompatible.
    /// Use [`GENERAL_FREIGHT`] in a pair to name ungrouped items.
    MixUnlessForbidden {
        forbidden_pairs: Vec<(String, String)>,
    },
}

impl Default for CompatibilityPolicy {
    fn default() -> Self {
        CompatibilityPolicy::StrictIsolation
    }
}

impl CompatibilityPolicy {
    /// Whether `item` may join `container` given what is already inside it.
    pub fn admits(&self, container: &PackedContainer, item: &Item) -> Result<(), Rejection> {
        let item_group = group_key(item);
        match self {
            CompatibilityPolicy::StrictIsolation => {
                // Read the group off the first placement, not the first placement that
                // happens to carry a group. Otherwise a container opened with ungrouped
                // freight reports no group and admits anything -- the MVP's bug.
                match container.placements.first() {
                    None => Ok(()),
                    Some(first) => {
                        let container_group = group_key(&first.item);
                        if container_group == item_group {
                            Ok(())
                        } else {
                            Err(Rejection::IncompatibleGroup {
                                container_group: container_group.to_string(),
                                item_group: item_group.to_string(),
                            })
                        }
                    }
                }
            }
            CompatibilityPolicy::UngroupedAreUniversal => {
                match (
                    container.assigned_compatibility_group(),
                    &item.compatibility_group,
                ) {
                    (Some(container_group), Some(ig)) if container_group != *ig => {
                        Err(Rejection::IncompatibleGroup {
                            container_group,
                            item_group: ig.clone(),
                        })
                    }
                    _ => Ok(()),
                }
            }
            CompatibilityPolicy::MixUnlessForbidden { forbidden_pairs } => {
                for placed in &container.placements {
                    let other = group_key(&placed.item);
                    if is_forbidden(forbidden_pairs, other, item_group) {
                        return Err(Rejection::IncompatibleGroup {
                            container_group: other.to_string(),
                            item_group: item_group.to_string(),
                        });
                    }
                }
                Ok(())
            }
        }
    }

    /// Whether this policy partitions items into sets that can never share a container.
    ///
    /// When true the packer solves each partition independently, which shrinks the search
    /// and keeps carton assignment deterministic.
    pub fn partitions_cleanly(&self) -> bool {
        matches!(self, CompatibilityPolicy::StrictIsolation)
    }
}

fn is_forbidden(pairs: &[(String, String)], a: &str, b: &str) -> bool {
    pairs
        .iter()
        .any(|(l, r)| (l == a && r == b) || (l == b && r == a))
}

/// The quality of a placement that passed every constraint. Fed back to the packer's
/// scoring so it can prefer well-supported placements among equally legal ones.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PlacementQuality {
    /// Fraction of the item's base resting on the floor or on items below, in 0.0..=1.0.
    pub support_ratio: f32,
}

/// The full set of physical rules applied to a packing run.
#[derive(Debug, Clone)]
pub struct ConstraintSet {
    /// How compatibility groups may mix. Defaults to [`CompatibilityPolicy::StrictIsolation`].
    pub compatibility: CompatibilityPolicy,
    /// Minimum fraction of an item's base that must rest on something solid, in 0.0..=1.0.
    /// `1.0` demands full support; `0.0` disables the check and reproduces the MVP's
    /// willingness to leave items floating.
    pub min_support_ratio: f32,
    /// Whether to honour `Item::max_load_kg` and `Item::fragile`.
    pub enforce_load_bearing: bool,
    /// Whether the container's own tare weight counts toward `Container::max_weight`.
    /// `true` reads `max_weight` as a gross (shipped) weight, `false` as a payload limit.
    pub count_tare_toward_max_weight: bool,
}

impl Default for ConstraintSet {
    fn default() -> Self {
        Self {
            compatibility: CompatibilityPolicy::default(),
            // 0.8 tolerates the modest overhang real packers allow, while still rejecting
            // the physically impossible placements the MVP produced.
            min_support_ratio: 0.8,
            enforce_load_bearing: true,
            count_tare_toward_max_weight: true,
        }
    }
}

impl ConstraintSet {
    /// A constraint set with every physical rule relaxed, matching the MVP solver.
    /// Useful for regression-comparing the two engines.
    pub fn permissive() -> Self {
        Self {
            compatibility: CompatibilityPolicy::UngroupedAreUniversal,
            min_support_ratio: 0.0,
            enforce_load_bearing: false,
            count_tare_toward_max_weight: false,
        }
    }

    /// Container-level rules: may this item join this container at all?
    ///
    /// Cheap enough to run once per item before any geometry is considered.
    pub fn check_admission(
        &self,
        container: &PackedContainer,
        item: &Item,
    ) -> Result<(), Rejection> {
        self.compatibility.admits(container, item)?;

        if let Some(max_weight) = container.container.max_weight {
            let current = if self.count_tare_toward_max_weight {
                container.gross_weight()
            } else {
                container.current_items_weight()
            };
            if current + item.weight > max_weight + WEIGHT_TOLERANCE_KG {
                return Err(Rejection::ContainerWeightExceeded);
            }
        }

        Ok(())
    }

    /// Geometry-level rules for one candidate position and orientation.
    ///
    /// Assumes [`Self::check_admission`] already passed for this (container, item) pair;
    /// use [`Self::check`] when you want both in one call.
    pub fn check_placement(
        &self,
        container: &PackedContainer,
        item: &Item,
        footprint: Space,
    ) -> Result<PlacementQuality, Rejection> {
        // 1. Container bounds. Widened to u64 so a malformed request cannot wrap.
        let c = &container.container;
        if footprint.x as u64 + footprint.width as u64 > c.width as u64
            || footprint.y as u64 + footprint.length as u64 > c.length as u64
            || footprint.z as u64 + footprint.depth as u64 > c.depth as u64
        {
            return Err(Rejection::OutOfBounds);
        }

        // 2. Overlap with items already placed.
        if container.placements.iter().any(|p| {
            p.collides_with(
                footprint.x,
                footprint.y,
                footprint.z,
                footprint.width,
                footprint.length,
                footprint.depth,
            )
        }) {
            return Err(Rejection::Collision);
        }

        // 3. Support. The MVP omitted this entirely, which let it float a full-width
        //    plate on a single narrow block.
        let support_ratio = support_ratio(container, &footprint);
        if support_ratio + f32::EPSILON < self.min_support_ratio {
            return Err(Rejection::InsufficientSupport {
                required_pct: (self.min_support_ratio * 100.0).round() as u32,
                actual_pct: (support_ratio * 100.0).floor() as u32,
            });
        }

        // 4. Load bearing and fragility.
        if self.enforce_load_bearing {
            self.check_load_bearing(container, item, &footprint)?;
        }

        Ok(PlacementQuality { support_ratio })
    }

    /// Admission and placement rules in one call.
    pub fn check(
        &self,
        container: &PackedContainer,
        item: &Item,
        footprint: Space,
    ) -> Result<PlacementQuality, Rejection> {
        self.check_admission(container, item)?;
        self.check_placement(container, item, footprint)
    }

    /// Splits items into sets that may never share a container.
    ///
    /// Returns a single set when the policy allows any group to mix. First-seen order is
    /// preserved both between and within partitions, so the result is deterministic and
    /// the caller's decreasing-volume sort survives.
    pub fn partition(&self, items: Vec<Item>) -> Vec<Vec<Item>> {
        if !self.compatibility.partitions_cleanly() {
            return vec![items];
        }

        let mut keys: Vec<String> = Vec::new();
        let mut groups: Vec<Vec<Item>> = Vec::new();
        for item in items {
            let key = group_key(&item).to_string();
            match keys.iter().position(|k| *k == key) {
                Some(idx) => groups[idx].push(item),
                None => {
                    keys.push(key);
                    groups.push(vec![item]);
                }
            }
        }
        groups
    }

    /// Walks every item sitting below the candidate and confirms none is asked to carry
    /// more than it can.
    ///
    /// Load is attributed to every item in the column beneath, not just the immediate
    /// neighbour, so a fragile item three layers down is still protected. Items with
    /// unlimited capacity short-circuit, which keeps the common case linear.
    fn check_load_bearing(
        &self,
        container: &PackedContainer,
        item: &Item,
        footprint: &Space,
    ) -> Result<(), Rejection> {
        /*
         * Evaluate the load-bearing state AFTER hypothetically adding the
         * candidate.
         *
         * This is considerably better than assigning the candidate's entire
         * weight to every item whose XY footprint happens to overlap it.
         */

        let mut placements = container.placements.clone();

        placements.push(Placement {
            item: item.clone(),
            x: footprint.x,
            y: footprint.y,
            z: footprint.z,
            width: footprint.width,
            length: footprint.length,
            depth: footprint.depth,
        });

        let mut memo: Vec<Option<f32>> = vec![None; placements.len()];

        for index in 0..placements.len() {
            let capacity = placements[index].item.effective_max_load();

            if capacity.is_infinite() {
                continue;
            }

            let load = load_borne_by(index, &placements, &mut memo);

            if load > capacity + f32::EPSILON {
                return Err(Rejection::LoadBearingExceeded {
                    blocking_item: placements[index].item.item_code.clone(),
                });
            }
        }

        Ok(())
    }
}

/// Weight currently borne by one placement, excluding its own weight.
///
/// Directly supported items distribute their transmitted load across all
/// supporting surfaces in proportion to contact area.
fn load_borne_by(support_index: usize, placements: &[Placement], memo: &mut [Option<f32>]) -> f32 {
    if let Some(value) = memo[support_index] {
        return value;
    }

    let support = &placements[support_index];

    let support_top = support.z as u64 + support.depth as u64;

    let mut total = 0.0f32;

    for (above_index, above) in placements.iter().enumerate() {
        if above_index == support_index {
            continue;
        }

        // Only direct physical contact transfers load.
        if above.z as u64 != support_top {
            continue;
        }

        let contact = placement_overlap_area(support, above);

        if contact == 0 {
            continue;
        }

        /*
         * Determine all placements supporting `above` at this exact level.
         * Its downward force is split according to overlap area.
         */
        let total_support_area: u64 = placements
            .iter()
            .enumerate()
            .filter(|(idx, candidate_support)| {
                *idx != above_index
                    && candidate_support.z as u64 + candidate_support.depth as u64 == above.z as u64
            })
            .map(|(_, candidate_support)| placement_overlap_area(candidate_support, above))
            .sum();

        if total_support_area == 0 {
            continue;
        }

        let above_borne = load_borne_by(above_index, placements, memo);

        let transmitted = above.item.weight + above_borne;

        let fraction = contact as f32 / total_support_area as f32;

        total += transmitted * fraction;
    }

    memo[support_index] = Some(total);

    total
}

/// XY contact area between two placements.
///
/// This intentionally ignores Z; callers decide whether the surfaces are at
/// a physically contacting height.
fn placement_overlap_area(a: &Placement, b: &Placement) -> u64 {
    let x = overlap_1d(a.x, a.width, b.x, b.width) as u64;

    let y = overlap_1d(a.y, a.length, b.y, b.length) as u64;

    x * y
}

/// Fraction of a candidate footprint's base resting on the container floor or on the top
/// faces of items already placed.
///
/// Only items whose top face is exactly level with the candidate's base contribute.
/// Placements never overlap each other, so contributions cannot be double counted.
pub fn support_ratio(container: &PackedContainer, footprint: &Space) -> f32 {
    if footprint.z == 0 {
        return 1.0; // resting on the container floor
    }
    let base_area = footprint.width as u64 * footprint.length as u64;
    if base_area == 0 {
        return 0.0;
    }

    let supported: u64 = container
        .placements
        .iter()
        .filter(|p| p.z + p.depth == footprint.z)
        .map(|p| {
            let ox = overlap_1d(footprint.x, footprint.width, p.x, p.width) as u64;
            let oy = overlap_1d(footprint.y, footprint.length, p.y, p.length) as u64;
            ox * oy
        })
        .sum();

    (supported as f64 / base_area as f64) as f32
}

/// Length of the overlap between two intervals given as (start, extent).
fn overlap_1d(a_start: u32, a_len: u32, b_start: u32, b_len: u32) -> u32 {
    let lo = a_start.max(b_start);
    let hi = (a_start + a_len).min(b_start + b_len);
    hi.saturating_sub(lo)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Container, Placement};

    fn container(max_weight: Option<f32>) -> Container {
        Container {
            reference: "MED".to_string(),
            width: 400,
            length: 400,
            depth: 400,
            max_weight,
            tare_weight: Some(1.0),
            active: true,
            max_containers: None,
        }
    }

    fn item(code: &str, group: Option<&str>, weight: f32) -> Item {
        Item {
            item_code: code.to_string(),
            item_reference: code.to_string(),
            width: 100,
            length: 100,
            depth: 100,
            weight,
            compatibility_group: group.map(|g| g.to_string()),
            fragile: false,
            max_load_kg: None,
            orientation: Default::default(),
        }
    }

    fn place(
        packed: &mut PackedContainer,
        item: Item,
        x: u32,
        y: u32,
        z: u32,
        w: u32,
        l: u32,
        d: u32,
    ) {
        packed.placements.push(Placement {
            item,
            x,
            y,
            z,
            width: w,
            length: l,
            depth: d,
        });
    }

    fn space(x: u32, y: u32, z: u32, w: u32, l: u32, d: u32) -> Space {
        Space {
            x,
            y,
            z,
            width: w,
            length: l,
            depth: d,
        }
    }

    #[test]
    fn strict_isolation_keeps_dangerous_goods_away_from_general_freight() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        place(
            &mut packed,
            item("GENERAL", None, 1.0),
            0,
            0,
            0,
            100,
            100,
            100,
        );

        // The MVP allowed this because the container reported no assigned group.
        let hazmat = item("HAZMAT", Some("DG"), 1.0);
        assert!(matches!(
            rules.check_admission(&packed, &hazmat),
            Err(Rejection::IncompatibleGroup { .. })
        ));

        // More general freight is still welcome.
        assert!(
            rules
                .check_admission(&packed, &item("GEN-2", None, 1.0))
                .is_ok()
        );
    }

    #[test]
    fn permissive_policy_reproduces_the_mvp_behaviour() {
        let rules = ConstraintSet {
            compatibility: CompatibilityPolicy::UngroupedAreUniversal,
            ..ConstraintSet::default()
        };
        let mut packed = PackedContainer::new(container(None));
        place(
            &mut packed,
            item("GENERAL", None, 1.0),
            0,
            0,
            0,
            100,
            100,
            100,
        );
        assert!(
            rules
                .check_admission(&packed, &item("HAZMAT", Some("DG"), 1.0))
                .is_ok()
        );
    }

    #[test]
    fn mix_unless_forbidden_blocks_only_declared_pairs() {
        let rules = ConstraintSet {
            compatibility: CompatibilityPolicy::MixUnlessForbidden {
                forbidden_pairs: vec![("DG".to_string(), GENERAL_FREIGHT.to_string())],
            },
            ..ConstraintSet::default()
        };
        let mut packed = PackedContainer::new(container(None));
        place(
            &mut packed,
            item("GENERAL", None, 1.0),
            0,
            0,
            0,
            100,
            100,
            100,
        );

        assert!(
            rules
                .check_admission(&packed, &item("HAZMAT", Some("DG"), 1.0))
                .is_err()
        );
        assert!(
            rules
                .check_admission(&packed, &item("FOOD", Some("FOOD"), 1.0))
                .is_ok()
        );
    }

    #[test]
    fn partition_splits_by_group_and_preserves_order() {
        let rules = ConstraintSet::default();
        let parts = rules.partition(vec![
            item("A1", Some("A"), 1.0),
            item("G1", None, 1.0),
            item("A2", Some("A"), 1.0),
            item("B1", Some("B"), 1.0),
        ]);
        assert_eq!(parts.len(), 3);
        let codes: Vec<Vec<&str>> = parts
            .iter()
            .map(|p| p.iter().map(|i| i.item_code.as_str()).collect())
            .collect();
        assert_eq!(codes[0], vec!["A1", "A2"]);
        assert_eq!(codes[1], vec!["G1"]);
        assert_eq!(codes[2], vec!["B1"]);
    }

    #[test]
    fn weight_limit_counts_tare_by_default() {
        // 4.0 payload + 1.0 tare = 5.0, exactly at the limit.
        let rules = ConstraintSet::default();
        let packed = PackedContainer::new(container(Some(5.0)));
        assert!(
            rules
                .check_admission(&packed, &item("X", None, 4.0))
                .is_ok()
        );
        assert!(matches!(
            rules.check_admission(&packed, &item("X", None, 4.5)),
            Err(Rejection::ContainerWeightExceeded)
        ));

        // Read as a payload limit the tare is ignored, so 4.5 fits.
        let payload_rules = ConstraintSet {
            count_tare_toward_max_weight: false,
            ..ConstraintSet::default()
        };
        assert!(
            payload_rules
                .check_admission(&packed, &item("X", None, 4.5))
                .is_ok()
        );
    }

    #[test]
    fn floor_placements_are_fully_supported() {
        let packed = PackedContainer::new(container(None));
        assert_eq!(support_ratio(&packed, &space(0, 0, 0, 350, 350, 30)), 1.0);
    }

    #[test]
    fn overhanging_placement_is_rejected() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        place(
            &mut packed,
            item("BLOCK", None, 1.0),
            0,
            0,
            0,
            200,
            200,
            140,
        );

        // The exact placement the MVP produced: a 350x350 plate on a 200x200 block.
        let plate = item("PLATE", None, 9.0);
        match rules.check_placement(&packed, &plate, space(0, 0, 140, 350, 350, 30)) {
            Err(Rejection::InsufficientSupport { actual_pct, .. }) => assert_eq!(actual_pct, 32),
            other => panic!("expected InsufficientSupport, got {:?}", other),
        }

        // A plate that fits on the block is fine.
        assert!(
            rules
                .check_placement(&packed, &plate, space(0, 0, 140, 200, 200, 30))
                .is_ok()
        );
    }

    #[test]
    fn support_may_be_shared_between_neighbours() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        place(&mut packed, item("L", None, 1.0), 0, 0, 0, 100, 200, 100);
        place(&mut packed, item("R", None, 1.0), 100, 0, 0, 100, 200, 100);

        // A 200x200 item bridges both, so it is fully supported.
        let quality = rules
            .check_placement(
                &packed,
                &item("TOP", None, 1.0),
                space(0, 0, 100, 200, 200, 50),
            )
            .expect("bridging placement should be legal");
        assert_eq!(quality.support_ratio, 1.0);
    }

    #[test]
    fn fragile_items_refuse_to_carry_anything() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        let mut glass = item("GLASS", None, 0.5);
        glass.fragile = true;
        place(&mut packed, glass, 0, 0, 0, 200, 200, 100);

        assert!(matches!(
            rules.check_placement(
                &packed,
                &item("HEAVY", None, 5.0),
                space(0, 0, 100, 200, 200, 100)
            ),
            Err(Rejection::LoadBearingExceeded { .. })
        ));
        // Standing beside it is fine.
        assert!(
            rules
                .check_placement(
                    &packed,
                    &item("HEAVY", None, 5.0),
                    space(200, 0, 0, 200, 200, 100)
                )
                .is_ok()
        );
    }

    #[test]
    fn load_bearing_accumulates_through_the_stack() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        let mut base = item("BASE", None, 1.0);
        base.max_load_kg = Some(5.0);
        place(&mut packed, base, 0, 0, 0, 200, 200, 100);
        place(
            &mut packed,
            item("MID", None, 3.0),
            0,
            0,
            100,
            200,
            200,
            100,
        );

        // BASE already carries 3.0 of its 5.0 allowance.
        assert!(
            rules
                .check_placement(
                    &packed,
                    &item("TOP", None, 1.5),
                    space(0, 0, 200, 200, 200, 100)
                )
                .is_ok()
        );
        assert!(matches!(
            rules.check_placement(
                &packed,
                &item("TOP", None, 2.5),
                space(0, 0, 200, 200, 200, 100)
            ),
            Err(Rejection::LoadBearingExceeded { blocking_item }) if blocking_item == "BASE"
        ));
    }

    #[test]
    fn bounds_and_collisions_are_caught() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        place(&mut packed, item("A", None, 1.0), 0, 0, 0, 200, 200, 100);

        assert_eq!(
            rules.check_placement(
                &packed,
                &item("B", None, 1.0),
                space(350, 0, 0, 100, 100, 100)
            ),
            Err(Rejection::OutOfBounds)
        );
        assert_eq!(
            rules.check_placement(
                &packed,
                &item("B", None, 1.0),
                space(100, 100, 0, 100, 100, 100)
            ),
            Err(Rejection::Collision)
        );
    }
}
