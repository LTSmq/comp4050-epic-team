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

/// Slack (kg) on the weight limit, so adding up many f32 weights cannot reject a
/// container that is exactly at its limit.
pub const WEIGHT_TOLERANCE_KG: f32 = 1e-4;

/// Group key applied to items that carry no explicit compatibility group.
///
/// Under [`CompatibilityPolicy::StrictIsolation`] this makes ungrouped items a real
/// compatibility group rather than a wildcard, so they do not implicitly mix with
/// explicitly grouped items.
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
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum CompatibilityPolicy {
    /// Every distinct group is isolated, and ungrouped items form their own group.
    ///
    /// This is currently the conservative default for BoxGroup handling.
    /// Compatibility semantics may be extended or made configurable as additional
    /// packing requirements are agreed by the team.
    #[default]
    StrictIsolation,
    /// Grouped items are isolated from each other, but ungrouped items may join any
    /// container. This reproduces the MVP behaviour where ungrouped items act as
    /// universally compatible items.
    UngroupedAreUniversal,
    /// Groups mix freely unless a pair is explicitly declared incompatible.
    /// Use [`GENERAL_FREIGHT`] in a pair to name ungrouped items.
    MixUnlessForbidden {
        forbidden_pairs: Vec<(String, String)>,
    },
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

        if item.effective_max_load().is_infinite()
            && container
                .placements
                .iter()
                .all(|p| p.item.effective_max_load().is_infinite())
        {
            return Ok(());
        }

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
// Length of the overlap between two intervals given as (start, extent).
// fn overlap_1d(a_start: u32, a_len: u32, b_start: u32, b_len: u32) -> u32 {
//     let lo = a_start.max(b_start);
//     let hi = (a_start + a_len).min(b_start + b_len);
//     hi.saturating_sub(lo)
// }
fn overlap_1d(a_start: u32, a_len: u32, b_start: u32, b_len: u32) -> u32 {
    let lo = a_start.max(b_start) as u64;
    let hi = (a_start as u64 + a_len as u64).min(b_start as u64 + b_len as u64);
    hi.saturating_sub(lo) as u32
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

    fn place(packed: &mut PackedContainer, item: Item, at: Space) {
        packed.placements.push(Placement {
            item,
            x: at.x,
            y: at.y,
            z: at.z,
            width: at.width,
            length: at.length,
            depth: at.depth,
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

    fn placement(item: Item, at: Space) -> Placement {
        Placement {
            item,
            x: at.x,
            y: at.y,
            z: at.z,
            width: at.width,
            length: at.length,
            depth: at.depth,
        }
    }

    fn load_on(index: usize, placements: &[Placement]) -> f32 {
        let mut memo: Vec<Option<f32>> = vec![None; placements.len()];
        load_borne_by(index, placements, &mut memo)
    }

    fn forbidding(pairs: &[(&str, &str)]) -> ConstraintSet {
        ConstraintSet {
            compatibility: CompatibilityPolicy::MixUnlessForbidden {
                forbidden_pairs: pairs
                    .iter()
                    .map(|(a, b)| (a.to_string(), b.to_string()))
                    .collect(),
            },
            ..ConstraintSet::default()
        }
    }

    fn container_holding(groups: &[Option<&str>]) -> PackedContainer {
        let mut packed = PackedContainer::new(container(None));
        for (i, group) in groups.iter().enumerate() {
            place(
                &mut packed,
                item(&format!("P{i}"), *group, 1.0),
                space(i as u32 * 100, 0, 0, 100, 100, 100),
            );
        }
        packed
    }

    fn admits(
        rules: &ConstraintSet,
        packed: &PackedContainer,
        group: Option<&str>,
    ) -> Result<(), Rejection> {
        rules.check_admission(packed, &item("NEW", group, 1.0))
    }

    #[test]
    fn strict_isolation_keeps_dangerous_goods_away_from_general_freight() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        place(
            &mut packed,
            item("GENERAL", None, 1.0),
            space(0, 0, 0, 100, 100, 100),
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
            space(0, 0, 0, 100, 100, 100),
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
            space(0, 0, 0, 100, 100, 100),
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
            space(0, 0, 0, 200, 200, 140),
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
        place(
            &mut packed,
            item("L", None, 1.0),
            space(0, 0, 0, 100, 200, 100),
        );
        place(
            &mut packed,
            item("R", None, 1.0),
            space(100, 0, 0, 100, 200, 100),
        );

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
        place(&mut packed, glass, space(0, 0, 0, 200, 200, 100));

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
        place(&mut packed, base, space(0, 0, 0, 200, 200, 100));
        place(
            &mut packed,
            item("MID", None, 3.0),
            space(0, 0, 100, 200, 200, 100),
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
        place(
            &mut packed,
            item("A", None, 1.0),
            space(0, 0, 0, 200, 200, 100),
        );

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

    #[test]
    fn overlap_1d_does_not_overflow() {
        assert_eq!(overlap_1d(u32::MAX - 5, 10, u32::MAX - 5, 10), 10);
    }

    #[test]
    fn load_is_split_evenly_across_equal_supports() {
        // TOP (4.0 kg) bridges L and R, which share it by contact area: 50% each.
        let placements = vec![
            placement(item("L", None, 1.0), space(0, 0, 0, 100, 200, 100)),
            placement(item("R", None, 1.0), space(100, 0, 0, 100, 200, 100)),
            placement(item("TOP", None, 4.0), space(0, 0, 100, 200, 200, 50)),
        ];

        assert!((load_on(0, &placements) - 2.0).abs() < 1e-4);
        assert!((load_on(1, &placements) - 2.0).abs() < 1e-4);
        assert_eq!(load_on(2, &placements), 0.0);
    }

    #[test]
    fn load_is_split_in_proportion_to_contact_area() {
        // L touches 20,000 mm2 of TOP and R touches 60,000 mm2, so they carry 25% and 75%.
        let placements = vec![
            placement(item("L", None, 1.0), space(0, 0, 0, 100, 200, 100)),
            placement(item("R", None, 1.0), space(100, 0, 0, 300, 200, 100)),
            placement(item("TOP", None, 4.0), space(0, 0, 100, 400, 200, 50)),
        ];

        assert!((load_on(0, &placements) - 1.0).abs() < 1e-4);
        assert!((load_on(1, &placements) - 3.0).abs() < 1e-4);
    }

    #[test]
    fn load_passes_down_through_a_middle_layer() {
        // TOP (4.0) rests on MID (2.0), which rests on L and R.
        // MID carries 4.0, and each support carries (2.0 + 4.0) / 2 = 3.0.
        let placements = vec![
            placement(item("L", None, 1.0), space(0, 0, 0, 100, 200, 100)),
            placement(item("R", None, 1.0), space(100, 0, 0, 100, 200, 100)),
            placement(item("MID", None, 2.0), space(0, 0, 100, 200, 200, 100)),
            placement(item("TOP", None, 4.0), space(0, 0, 200, 200, 200, 100)),
        ];

        assert!((load_on(0, &placements) - 3.0).abs() < 1e-4);
        assert!((load_on(1, &placements) - 3.0).abs() < 1e-4);
        assert!((load_on(2, &placements) - 4.0).abs() < 1e-4);
        assert_eq!(load_on(3, &placements), 0.0);
    }

    #[test]
    fn items_that_do_not_touch_transfer_no_load() {
        // TOP floats 50mm above L, so there is no direct contact and no load.
        let placements = vec![
            placement(item("L", None, 1.0), space(0, 0, 0, 100, 100, 100)),
            placement(item("TOP", None, 4.0), space(0, 0, 150, 100, 100, 50)),
        ];

        assert_eq!(load_on(0, &placements), 0.0);
    }

    #[test]
    fn a_shared_load_is_checked_against_each_support_separately() {
        // L can carry 2.5 kg. A 4.0 kg item splits 2.0 onto L, so it is fine.
        // A 5.5 kg item puts 2.75 on L, which is too much. On a single support
        // both would be rejected, so this only passes because the load is split.
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        let mut left = item("L", None, 1.0);
        left.max_load_kg = Some(2.5);
        place(&mut packed, left, space(0, 0, 0, 100, 200, 100));
        place(
            &mut packed,
            item("R", None, 1.0),
            space(100, 0, 0, 100, 200, 100),
        );

        let on_top = space(0, 0, 100, 200, 200, 50);
        assert!(
            rules
                .check_placement(&packed, &item("TOP", None, 4.0), on_top)
                .is_ok()
        );
        assert!(matches!(
            rules.check_placement(&packed, &item("TOP", None, 5.5), on_top),
            Err(Rejection::LoadBearingExceeded { blocking_item }) if blocking_item == "L"
        ));
    }

    // Mixes items unless forbidden. DG = Dangerous Goods.
    #[test]
    fn several_forbidden_pairs_each_block_only_their_own_groups() {
        let rules = forbidding(&[("DG", "FOOD"), ("DG", GENERAL_FREIGHT), ("FOOD", "CHEM")]);

        let food = container_holding(&[Some("FOOD")]);
        assert!(admits(&rules, &food, Some("DG")).is_err());
        assert!(admits(&rules, &food, Some("CHEM")).is_err());
        assert!(admits(&rules, &food, Some("FOOD")).is_ok());
        assert!(admits(&rules, &food, None).is_ok());
        assert!(admits(&rules, &food, Some("TOOLS")).is_ok());

        let dg = container_holding(&[Some("DG")]);
        assert!(admits(&rules, &dg, Some("FOOD")).is_err());
        assert!(admits(&rules, &dg, None).is_err());
        assert!(admits(&rules, &dg, Some("CHEM")).is_ok());
        assert!(admits(&rules, &dg, Some("TOOLS")).is_ok());

        let chem = container_holding(&[Some("CHEM")]);
        assert!(admits(&rules, &chem, Some("FOOD")).is_err());
        assert!(admits(&rules, &chem, Some("DG")).is_ok());

        let general = container_holding(&[None]);
        assert!(admits(&rules, &general, Some("DG")).is_err());
        assert!(admits(&rules, &general, Some("FOOD")).is_ok());
        assert!(admits(&rules, &general, Some("CHEM")).is_ok());
    }

    #[test]
    fn forbidden_pairs_work_in_either_order() {
        // The pair is listed as (DG, FOOD), but it blocks both directions.
        let rules = forbidding(&[("DG", "FOOD")]);

        assert!(admits(&rules, &container_holding(&[Some("FOOD")]), Some("DG")).is_err());
        assert!(admits(&rules, &container_holding(&[Some("DG")]), Some("FOOD")).is_err());
    }

    #[test]
    fn every_placed_item_is_checked_not_just_the_first() {
        // StrictIsolation reads only the first placement. Here the clash is with the
        // second item (FOOD), while the first (general freight) is harmless to CHEM.
        let rules = forbidding(&[("FOOD", "CHEM"), ("DG", "FOOD")]);
        let mixed = container_holding(&[None, Some("FOOD")]);

        assert!(admits(&rules, &mixed, Some("CHEM")).is_err());
        assert!(admits(&rules, &mixed, Some("DG")).is_err());
        assert!(admits(&rules, &mixed, Some("TOOLS")).is_ok());
    }

    #[test]
    fn the_rejection_names_the_group_that_clashed() {
        let rules = forbidding(&[("FOOD", "CHEM")]);
        let packed = container_holding(&[Some("TOOLS"), Some("FOOD")]);

        match admits(&rules, &packed, Some("CHEM")) {
            Err(Rejection::IncompatibleGroup {
                container_group,
                item_group,
            }) => {
                assert_eq!(container_group, "FOOD");
                assert_eq!(item_group, "CHEM");
            }
            other => panic!("expected IncompatibleGroup, got {:?}", other),
        }
    }

    #[test]
    fn an_empty_container_admits_any_group_under_forbidden_pairs() {
        let rules = forbidding(&[("DG", "FOOD"), ("FOOD", "CHEM")]);
        let empty = container_holding(&[]);

        for group in [Some("DG"), Some("FOOD"), Some("CHEM"), None] {
            assert!(admits(&rules, &empty, group).is_ok());
        }
    }

    #[test]
    fn an_empty_pair_list_forbids_nothing_and_does_not_partition() {
        let rules = forbidding(&[]);
        let packed = container_holding(&[Some("DG"), Some("FOOD")]);

        assert!(admits(&rules, &packed, Some("CHEM")).is_ok());

        // Mixing is allowed, so every item stays in one set.
        let parts = rules.partition(vec![item("A1", Some("A"), 1.0), item("G1", None, 1.0)]);
        assert_eq!(parts.len(), 1);
        assert_eq!(parts[0].len(), 2);
    }

    #[test]
    fn check_passes_when_admission_and_placement_both_pass() {
        let rules = ConstraintSet::default();
        let packed = PackedContainer::new(container(None));

        let quality = rules
            .check(
                &packed,
                &item("A", None, 1.0),
                space(0, 0, 0, 100, 100, 100),
            )
            .expect("an empty container should accept a floor placement");
        assert_eq!(quality.support_ratio, 1.0);
    }

    #[test]
    fn check_reports_a_placement_failure_when_admission_passes() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        place(
            &mut packed,
            item("BASE", None, 1.0),
            space(0, 0, 0, 100, 100, 100),
        );
        let newcomer = item("B", None, 1.0);

        assert_eq!(
            rules.check(&packed, &newcomer, space(350, 0, 0, 100, 100, 100)),
            Err(Rejection::OutOfBounds)
        );
        assert_eq!(
            rules.check(&packed, &newcomer, space(50, 0, 0, 100, 100, 100)),
            Err(Rejection::Collision)
        );
    }

    #[test]
    fn check_reports_a_weight_failure_before_looking_at_geometry() {
        // 1.0 tare + 4.5 is over the 5.0 limit. The footprint is also out of bounds,
        // but admission runs first, so the weight is what gets reported.
        let rules = ConstraintSet::default();
        let packed = PackedContainer::new(container(Some(5.0)));

        assert_eq!(
            rules.check(
                &packed,
                &item("HEAVY", None, 4.5),
                space(350, 0, 0, 100, 100, 100)
            ),
            Err(Rejection::ContainerWeightExceeded)
        );
    }

    #[test]
    fn check_reports_a_group_clash_before_looking_at_geometry() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        place(
            &mut packed,
            item("GENERAL", None, 1.0),
            space(0, 0, 0, 100, 100, 100),
        );
        let hazmat = item("HAZMAT", Some("DG"), 1.0);

        // A legal position and an out of bounds one give the same answer.
        for footprint in [
            space(100, 0, 0, 100, 100, 100),
            space(350, 0, 0, 100, 100, 100),
        ] {
            assert!(matches!(
                rules.check(&packed, &hazmat, footprint),
                Err(Rejection::IncompatibleGroup { .. })
            ));
        }
    }

    #[test]
    fn check_returns_the_support_quality_of_a_legal_placement() {
        // Half of the plate's base rests on the block. The default ratio of 0.8 would
        // refuse that, so relax it and read the quality back.
        let rules = ConstraintSet {
            min_support_ratio: 0.0,
            ..ConstraintSet::default()
        };
        let mut packed = PackedContainer::new(container(None));
        place(
            &mut packed,
            item("BLOCK", None, 1.0),
            space(0, 0, 0, 200, 200, 100),
        );

        let quality = rules
            .check(
                &packed,
                &item("PLATE", None, 1.0),
                space(100, 0, 100, 200, 200, 50),
            )
            .expect("support is not enforced with a ratio of zero");
        assert_eq!(quality.support_ratio, 0.5);
    }

    #[test]
    fn check_is_admission_followed_by_placement() {
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(Some(10.0)));
        place(
            &mut packed,
            item("BASE", None, 1.0),
            space(0, 0, 0, 100, 100, 100),
        );

        let cases = [
            (item("OK", None, 1.0), space(100, 0, 0, 100, 100, 100)),
            (item("HEAVY", None, 20.0), space(100, 0, 0, 100, 100, 100)),
            (item("DG", Some("DG"), 1.0), space(100, 0, 0, 100, 100, 100)),
            (item("OVERLAP", None, 1.0), space(50, 0, 0, 100, 100, 100)),
            (item("OUT", None, 1.0), space(350, 0, 0, 100, 100, 100)),
        ];

        for (newcomer, footprint) in cases {
            let two_steps = match rules.check_admission(&packed, &newcomer) {
                Err(rejection) => Err(rejection),
                Ok(()) => rules.check_placement(&packed, &newcomer, footprint),
            };
            assert_eq!(
                rules.check(&packed, &newcomer, footprint),
                two_steps,
                "case {}",
                newcomer.item_code
            );
        }
    }

    #[test]
    fn every_rejection_has_its_own_readable_message() {
        let cases = [
            (
                Rejection::ContainerWeightExceeded,
                "container weight limit would be exceeded",
            ),
            (
                Rejection::IncompatibleGroup {
                    container_group: "DG".to_string(),
                    item_group: "FOOD".to_string(),
                },
                "compatibility group 'FOOD' may not share a container with 'DG'",
            ),
            (
                Rejection::OutOfBounds,
                "item would protrude beyond the container",
            ),
            (
                Rejection::Collision,
                "item would overlap an item already placed",
            ),
            (
                Rejection::InsufficientSupport {
                    required_pct: 80,
                    actual_pct: 32,
                },
                "only 32% of the item's base would be supported, 80% required",
            ),
            (
                Rejection::LoadBearingExceeded {
                    blocking_item: "BASE".to_string(),
                },
                "item 'BASE' underneath cannot bear the additional weight",
            ),
            (
                Rejection::NoFreeSpace,
                "no free space large enough in this container",
            ),
        ];

        for (rejection, expected) in cases {
            assert_eq!(rejection.to_string(), expected);
        }
    }

    #[test]
    fn incompatible_group_message_names_the_item_group_first() {
        // The wording reads "item group may not share with container group", so swapping
        // the two fields would flip the meaning.
        let message = Rejection::IncompatibleGroup {
            container_group: "CONTAINER-SIDE".to_string(),
            item_group: "ITEM-SIDE".to_string(),
        }
        .to_string();

        let item_pos = message.find("ITEM-SIDE").expect("item group missing");
        let container_pos = message
            .find("CONTAINER-SIDE")
            .expect("container group missing");
        assert!(item_pos < container_pos);
    }

    #[test]
    fn rejection_messages_carry_the_real_numbers_from_a_failed_check() {
        // The plate from the overhang test: 350x350 on a 200x200 block, 32% supported
        // against the default requirement of 80%.
        let rules = ConstraintSet::default();
        let mut packed = PackedContainer::new(container(None));
        place(
            &mut packed,
            item("BLOCK", None, 1.0),
            space(0, 0, 0, 200, 200, 140),
        );

        let rejection = rules
            .check_placement(
                &packed,
                &item("PLATE", None, 9.0),
                space(0, 0, 140, 350, 350, 30),
            )
            .unwrap_err();
        assert_eq!(
            rejection.to_string(),
            "only 32% of the item's base would be supported, 80% required"
        );
    }

    #[test]
    fn rejection_messages_are_all_different() {
        let messages = [
            Rejection::ContainerWeightExceeded.to_string(),
            Rejection::IncompatibleGroup {
                container_group: "A".to_string(),
                item_group: "B".to_string(),
            }
            .to_string(),
            Rejection::OutOfBounds.to_string(),
            Rejection::Collision.to_string(),
            Rejection::InsufficientSupport {
                required_pct: 80,
                actual_pct: 10,
            }
            .to_string(),
            Rejection::LoadBearingExceeded {
                blocking_item: "X".to_string(),
            }
            .to_string(),
            Rejection::NoFreeSpace.to_string(),
        ];

        for (i, a) in messages.iter().enumerate() {
            for b in messages.iter().skip(i + 1) {
                assert_ne!(a, b);
            }
        }
    }
}
