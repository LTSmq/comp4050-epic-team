//! Packing algorithm for the Perfect Fit optimisation engine.
//!
//! This is the next-generation replacement for `solver.rs`. It keeps that module's
//! decreasing-volume ordering but replaces both of its weak points:
//!
//! * **Placement search.** The MVP tracked bare anchor *points* and accepted the first
//!   position that did not collide. Anchor points were never retired once buried, and
//!   because a point carries no extent the search could not tell a tight gap from an
//!   open one. This module tracks maximal free *spaces* ([`Space`]) instead: each
//!   placement subtracts its footprint from every overlapping space, and the resulting
//!   slabs are pruned so no space is contained in another. A space knows its extent, so
//!   the search can score how snugly an item fits.
//!
//! * **Container selection.** The MVP opened the smallest carton that could hold the
//!   next item, which turns eight 140mm cubes into eight small cartons when one medium
//!   carton would take all of them. This module trial-packs every eligible carton type
//!   and commits the best-scoring trial, providing a stronger best-fit heuristic.
//!
//! Physical legality is not decided here -- every candidate is validated by
//! [`ConstraintSet`], so support, fragility, weight and compatibility rules apply to the
//! search automatically.
//!
//! # Complexity
//!
//! Placing one item costs `O(spaces * orientations * placements)`. Choosing one carton
//! trial-packs each active container type, so a full run is roughly
//! `O(cartons * types * items^2 * spaces)`. That is comfortable for order-sized inputs
//! (tens to low hundreds of items). For larger jobs set
//! [`PackerConfig::trial_all_container_types`] to `false` to fall back to first-fit
//! carton selection.

use std::collections::HashMap;
use std::fmt;

use serde::Serialize;

use crate::constraints::{ConstraintSet, Rejection};
use crate::types::{Container, Item, PackedContainer, Placement, Space};

/// Search and carton-selection tuning. Physical rules live in [`ConstraintSet`].
#[derive(Debug, Clone)]
pub struct PackerConfig {
    /// Trial-pack every eligible container type and commit the best (true, the default),
    /// or commit the first container type that accepts anything (false, much faster and
    /// close to the MVP's behaviour).
    pub trial_all_container_types: bool,
    /// Hard ceiling on cartons opened, so a pathological input cannot spin forever.
    pub max_containers_opened: usize,
}

impl Default for PackerConfig {
    fn default() -> Self {
        Self {
            trial_all_container_types: true,
            max_containers_opened: 10_000,
        }
    }
}

/// A request that cannot be packed at all, as opposed to one that merely leaves items
/// over. Leftovers are reported in [`PackingSolution::unpacked`], not as an error.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PackerError {
    /// No container type was marked active.
    NoActiveContainers,
    /// A container has a zero extent, so nothing can ever go in it.
    InvalidContainer { reference: String, reason: String },
    /// An item has a zero extent or a weight that is negative or not a number.
    InvalidItem { item_code: String, reason: String },
}

impl fmt::Display for PackerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PackerError::NoActiveContainers => {
                write!(f, "no active container types were supplied")
            }
            PackerError::InvalidContainer { reference, reason } => {
                write!(f, "container '{}' is invalid: {}", reference, reason)
            }
            PackerError::InvalidItem { item_code, reason } => {
                write!(f, "item '{}' is invalid: {}", item_code, reason)
            }
        }
    }
}

impl std::error::Error for PackerError {}

/// An item the engine could not place, with the reason it gave up.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct UnpackedItem {
    pub item: Item,
    pub reason: String,
}

/// The result of a packing run.
///
/// Unlike the MVP, which returned `Err` as soon as one item would not fit, an
/// unplaceable item is reported alongside the cartons that *were* filled. A partial
/// answer plus a reason is far more useful to the portal than no answer.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct PackingSolution {
    pub containers: Vec<PackedContainer>,
    pub unpacked: Vec<UnpackedItem>,
}

impl PackingSolution {
    /// Whether every item was placed.
    pub fn is_complete(&self) -> bool {
        self.unpacked.is_empty()
    }

    pub fn container_count(&self) -> usize {
        self.containers.len()
    }

    pub fn packed_item_count(&self) -> usize {
        self.containers.iter().map(|c| c.placements.len()).sum()
    }

    /// Total weight of every carton including tare, in kg.
    pub fn total_gross_weight(&self) -> f32 {
        self.containers.iter().map(|c| c.gross_weight()).sum()
    }

    /// Fraction of the opened cartons' combined volume filled by items, in 0.0..=1.0.
    /// This is the headline "wasted space" number the brief asks the engine to reduce.
    pub fn utilisation(&self) -> f32 {
        let used: u64 = self.containers.iter().map(|c| c.used_volume_mm3()).sum();
        let capacity: u64 = self
            .containers
            .iter()
            .map(|c| {
                c.container.width as u64 * c.container.length as u64 * c.container.depth as u64
            })
            .sum();
        if capacity == 0 {
            return 0.0;
        }
        (used as f64 / capacity as f64) as f32
    }

    /// How many cartons of each type were opened, sorted by reference.
    pub fn container_mix(&self) -> Vec<(String, usize)> {
        let mut counts: HashMap<String, usize> = HashMap::new();
        for c in &self.containers {
            *counts.entry(c.container.reference.clone()).or_insert(0) += 1;
        }
        let mut mix: Vec<(String, usize)> = counts.into_iter().collect();
        mix.sort();
        mix
    }
}

/// The three-dimensional bin packer.
pub struct Packer {
    /// Active container types, ascending by volume so ties prefer the smaller carton.
    containers: Vec<Container>,
    constraints: ConstraintSet,
    config: PackerConfig,
}

impl Packer {
    /// Builds a packer with the default constraint set and configuration.
    pub fn new(containers: Vec<Container>) -> Self {
        let mut active: Vec<Container> = containers.into_iter().filter(|c| c.active).collect();
        active.sort_by(|a, b| {
            volume_mm3(a.width, a.length, a.depth)
                .cmp(&volume_mm3(b.width, b.length, b.depth))
                .then_with(|| a.reference.cmp(&b.reference))
        });
        Self {
            containers: active,
            constraints: ConstraintSet::default(),
            config: PackerConfig::default(),
        }
    }

    pub fn with_constraints(mut self, constraints: ConstraintSet) -> Self {
        self.constraints = constraints;
        self
    }

    pub fn with_config(mut self, config: PackerConfig) -> Self {
        self.config = config;
        self
    }

    pub fn constraints(&self) -> &ConstraintSet {
        &self.constraints
    }

    /// Packs `items` using a best-fit heuristic intended to minimise carton count
    /// and wasted space while satisfying the configured constraints.
    ///
    /// Returns `Err` only when the request itself is unusable. Items that simply do not
    /// fit come back in [`PackingSolution::unpacked`].
    pub fn pack(&self, items: Vec<Item>) -> Result<PackingSolution, PackerError> {
        self.validate(&items)?;

        let mut solution = PackingSolution {
            containers: Vec::new(),
            unpacked: Vec::new(),
        };

        // Supply is tracked across every compatibility partition, so `max_containers`
        // is a limit on the whole run rather than per group.
        let mut used_by_type: HashMap<String, usize> = HashMap::new();

        for partition in self.constraints.partition(sort_for_packing(items)) {
            self.pack_partition(partition, &mut used_by_type, &mut solution);
        }

        Ok(solution)
    }

    /// Packs one set of mutually compatible items.
    fn pack_partition(
        &self,
        partition: Vec<Item>,
        used_by_type: &mut HashMap<String, usize>,
        solution: &mut PackingSolution,
    ) {
        let mut remaining = partition;

        while !remaining.is_empty() {
            if solution.containers.len() >= self.config.max_containers_opened {
                break;
            }

            let Some(trial) = self.choose_container(&remaining, used_by_type) else {
                break; // nothing left can take any remaining item
            };

            *used_by_type
                .entry(trial.container.container.reference.clone())
                .or_insert(0) += 1;

            // Keep only the items this carton did not take. `placed` is ascending, so a
            // single ordered walk is enough and relative order is preserved.
            let mut placed = trial.placed.iter().copied().peekable();
            remaining = remaining
                .into_iter()
                .enumerate()
                .filter(|(idx, _)| {
                    if placed.peek() == Some(idx) {
                        placed.next();
                        false
                    } else {
                        true
                    }
                })
                .map(|(_, item)| item)
                .collect();

            solution.containers.push(trial.container);
        }

        // Whatever is left could not be placed anywhere. Re-derive a reason per item so
        // the portal can explain the failure.
        for item in remaining {
            let reason = self.explain_failure(&item, used_by_type);
            solution.unpacked.push(UnpackedItem { item, reason });
        }
    }

    /// Trial-packs the eligible container types and returns the best-scoring trial.
    fn choose_container(
        &self,
        remaining: &[Item],
        used_by_type: &HashMap<String, usize>,
    ) -> Option<Trial> {
        let mut best: Option<(TrialScore, Trial)> = None;

        for container in &self.containers {
            if self.supply_exhausted(container, used_by_type) {
                continue;
            }

            let trial = self.trial_pack(container, remaining);
            if trial.placed.is_empty() {
                continue;
            }

            if !self.config.trial_all_container_types {
                return Some(trial); // first-fit: containers are already smallest-first
            }

            let score = TrialScore::of(&trial, remaining.len());
            let is_better = match &best {
                None => true,
                Some((best_score, _)) => score < *best_score,
            };
            if is_better {
                best = Some((score, trial));
            }
        }

        best.map(|(_, trial)| trial)
    }

    fn supply_exhausted(
        &self,
        container: &Container,
        used_by_type: &HashMap<String, usize>,
    ) -> bool {
        match container.max_containers {
            None => false,
            Some(max) => used_by_type.get(&container.reference).copied().unwrap_or(0) >= max,
        }
    }

    /// Fills one fresh carton of the given type with as many items as it will take,
    /// without committing anything.
    fn trial_pack(&self, container: &Container, items: &[Item]) -> Trial {
        let mut packed = PackedContainer::new(container.clone());
        let mut free = vec![Space {
            x: 0,
            y: 0,
            z: 0,
            width: container.width,
            length: container.length,
            depth: container.depth,
        }];
        let mut placed = Vec::new();

        // Any free space smaller than the smallest remaining item in all three axes is
        // dead weight in the search. Computed once from the full candidate list, so the
        // bound stays valid as items are consumed.
        let min_extent = items
            .iter()
            .map(|i| i.width.min(i.length).min(i.depth))
            .min()
            .unwrap_or(0);

        for (index, item) in items.iter().enumerate() {
            // Cheap container-level veto before any geometry is considered.
            if self.constraints.check_admission(&packed, item).is_err() {
                continue;
            }

            let Some(placement) = self.best_placement(&packed, &free, item) else {
                continue;
            };

            free = subtract_all(&free, &placement.footprint(), min_extent);
            packed.placements.push(placement);
            placed.push(index);
        }

        Trial {
            container: packed,
            placed,
        }
    }

    /// Finds the best legal position and orientation for one item.
    ///
    /// For each maximal free space and allowed orientation, the search considers
    /// all four XY corners at the lowest Z level of that space. This allows a
    /// placement to succeed on another edge when support or load-bearing rules
    /// reject the minimum corner.
    ///
    /// Among legal candidates the lowest placement wins first, followed by the
    /// tightest fit, strongest support, and deterministic Y/X tie-breaking.
    fn best_placement(
        &self,
        packed: &PackedContainer,
        free: &[Space],
        item: &Item,
    ) -> Option<Placement> {
        let orientations = item.allowed_orientations();

        let mut best: Option<(PlacementScore, Space)> = None;

        for space in free {
            for &(width, length, depth) in &orientations {
                if !space.fits(width, length, depth) {
                    continue;
                }

                /*
                 * A maximal free space can contain a legal placement away from its
                 * minimum corner, particularly when support/load-bearing constraints
                 * reject one edge but another edge is valid.
                 *
                 * Test all four XY corners while keeping the item at the lowest Z
                 * level of this free space.
                 */

                let min_x = space.x;
                let min_y = space.y;

                let max_x = space.x + (space.width - width);

                let max_y = space.y + (space.length - length);

                let mut xy_candidates = vec![
                    (min_x, min_y),
                    (max_x, min_y),
                    (min_x, max_y),
                    (max_x, max_y),
                ];

                xy_candidates.sort_unstable();
                xy_candidates.dedup();

                for (x, y) in xy_candidates {
                    let footprint = Space {
                        x,
                        y,
                        z: space.z,
                        width,
                        length,
                        depth,
                    };

                    let Ok(quality) = self.constraints.check_placement(packed, item, footprint)
                    else {
                        continue;
                    };

                    let score = PlacementScore {
                        z: footprint.z,

                        // Score unused volume in the parent maximal space.
                        wasted_mm3: space.volume_mm3().saturating_sub(footprint.volume_mm3()),

                        unsupported_permille: ((1.0 - quality.support_ratio) * 1000.0).round()
                            as u32,

                        y: footprint.y,
                        x: footprint.x,
                    };

                    if best.as_ref().map_or(true, |(current, _)| score < *current) {
                        best = Some((score, footprint));
                    }
                }
            }
        }

        best.map(|(_, footprint)| Placement {
            item: item.clone(),
            x: footprint.x,
            y: footprint.y,
            z: footprint.z,
            width: footprint.width,
            length: footprint.length,
            depth: footprint.depth,
        })
    }

    /// Works out why an item never found a home, for the unpacked report.
    fn explain_failure(&self, item: &Item, used_by_type: &HashMap<String, usize>) -> String {
        let mut best_reason: Option<Rejection> = None;

        for container in &self.containers {
            if self.supply_exhausted(container, used_by_type) {
                continue;
            }
            let empty = PackedContainer::new(container.clone());
            // An empty carton has no compatibility or collision constraints, so anything
            // that fails here fails on the item's own merits.
            let mut fits_somehow = false;
            for &(w, l, d) in &item.allowed_orientations() {
                let footprint = Space {
                    x: 0,
                    y: 0,
                    z: 0,
                    width: w,
                    length: l,
                    depth: d,
                };
                match self.constraints.check(&empty, item, footprint) {
                    Ok(_) => {
                        fits_somehow = true;
                        break;
                    }
                    Err(reason) => {
                        if best_reason.is_none() {
                            best_reason = Some(reason);
                        }
                    }
                }
            }
            if fits_somehow {
                // It fits an empty carton of this type, so the run simply ran out of
                // cartons or of compatible space in the ones it opened.
                return format!(
                    "fits an empty '{}' but no compatible carton with room was available \
                     (container supply may be exhausted)",
                    container.reference
                );
            }
        }

        match best_reason {
            Some(reason) => format!("does not fit any available container: {}", reason),
            None => "no container type was available".to_string(),
        }
    }

    fn validate(&self, items: &[Item]) -> Result<(), PackerError> {
        if self.containers.is_empty() {
            return Err(PackerError::NoActiveContainers);
        }

        for c in &self.containers {
            if c.width == 0 || c.length == 0 || c.depth == 0 {
                return Err(PackerError::InvalidContainer {
                    reference: c.reference.clone(),
                    reason: "has a zero extent".to_string(),
                });
            }

            if let Some(max_weight) = c.max_weight {
                if !max_weight.is_finite() || max_weight < 0.0 {
                    return Err(PackerError::InvalidContainer {
                        reference: c.reference.clone(),
                        reason: "has a negative or non-finite maximum weight".to_string(),
                    });
                }
            }

            if let Some(tare) = c.tare_weight {
                if !tare.is_finite() || tare < 0.0 {
                    return Err(PackerError::InvalidContainer {
                        reference: c.reference.clone(),
                        reason: "has a negative or non-finite tare weight".to_string(),
                    });
                }

                if let Some(max_weight) = c.max_weight {
                    if self.constraints.count_tare_toward_max_weight && tare > max_weight {
                        return Err(PackerError::InvalidContainer {
                            reference: c.reference.clone(),
                            reason: format!(
                                "tare weight ({tare} kg) exceeds gross maximum weight ({max_weight} kg)"
                            ),
                        });
                    }
                }
            }
        }

        for item in items {
            if item.width == 0 || item.length == 0 || item.depth == 0 {
                return Err(PackerError::InvalidItem {
                    item_code: item.item_code.clone(),
                    reason: "has a zero extent".to_string(),
                });
            }

            if !item.weight.is_finite() || item.weight < 0.0 {
                return Err(PackerError::InvalidItem {
                    item_code: item.item_code.clone(),
                    reason: "has a negative or non-finite weight".to_string(),
                });
            }

            if let Some(max_load) = item.max_load_kg {
                if !max_load.is_finite() || max_load < 0.0 {
                    return Err(PackerError::InvalidItem {
                        item_code: item.item_code.clone(),
                        reason: "has a negative or non-finite maximum load".to_string(),
                    });
                }
            }
        }

        let ratio = self.constraints.min_support_ratio;

        if !ratio.is_finite() || !(0.0..=1.0).contains(&ratio) {
            return Err(PackerError::InvalidContainer {
                reference: "<constraint configuration>".to_string(),
                reason: format!("minimum support ratio must be between 0 and 1, got {ratio}"),
            });
        }

        Ok(())
    }
}

/// One fresh carton filled speculatively, plus the indices it took from the candidate
/// list. Nothing is committed until the trial wins.
struct Trial {
    container: PackedContainer,
    placed: Vec<usize>,
}

/// How good a trial carton is. Smaller is better.
///
/// Trials are compared lexicographically in this order:
///
/// 1. A carton that finishes the remaining job beats an incomplete trial.
/// 2. Otherwise prefer the trial leaving the fewest items unpacked.
/// 3. Then prefer the carton with the highest utilisation.
/// 4. Finally prefer the physically smaller carton.
///
/// This is a heuristic carton-selection strategy; it does not claim globally
/// optimal 3D bin packing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct TrialScore {
    /// Complete solutions always beat incomplete ones.
    incomplete: u8,

    /// Primary heuristic for incomplete trials:
    /// remove as many items from the remaining problem as possible.
    left_over: u64,

    /// Then prefer the denser carton.
    inv_utilisation_ppm: u64,

    /// Finally prefer the physically smaller carton.
    container_volume_mm3: u64,
}

impl TrialScore {
    fn of(trial: &Trial, candidate_count: usize) -> Self {
        let c = &trial.container.container;
        let capacity = volume_mm3(c.width, c.length, c.depth);
        let used = trial.container.used_volume_mm3();
        let utilisation_ppm = if capacity == 0 {
            0
        } else {
            used.saturating_mul(1_000_000) / capacity
        };

        let left_over = (candidate_count - trial.placed.len()) as u64;
        Self {
            incomplete: if left_over == 0 { 0 } else { 1 },
            left_over,
            inv_utilisation_ppm: 1_000_000u64.saturating_sub(utilisation_ppm),
            container_volume_mm3: capacity,
        }
    }
}

/// Lexicographic placement preference; smaller is better.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct PlacementScore {
    z: u32,
    wasted_mm3: u64,
    unsupported_permille: u32,
    y: u32,
    x: u32,
}

/// Decreasing volume, then longest edge, then weight, then item code.
///
/// Big awkward items go in while the carton is still empty. The trailing code comparison
/// makes runs reproducible when items are otherwise identical.
fn sort_for_packing(mut items: Vec<Item>) -> Vec<Item> {
    items.sort_by(|a, b| {
        b.volume_mm3()
            .cmp(&a.volume_mm3())
            .then_with(|| {
                let longest = |i: &Item| i.width.max(i.length).max(i.depth);
                longest(b).cmp(&longest(a))
            })
            .then_with(|| b.weight.total_cmp(&a.weight))
            .then_with(|| a.item_code.cmp(&b.item_code))
    });
    items
}

fn volume_mm3(width: u32, length: u32, depth: u32) -> u64 {
    width as u64 * length as u64 * depth as u64
}

/// Removes `occupied` from every free space, then prunes the result.
fn subtract_all(free: &[Space], occupied: &Space, min_extent: u32) -> Vec<Space> {
    let mut next: Vec<Space> = Vec::with_capacity(free.len() * 2);
    for space in free {
        next.extend(subtract(space, occupied));
    }
    prune(next, min_extent)
}

/// The maximal-spaces difference: the part of `space` not covered by `occupied`,
/// expressed as up to six overlapping slabs.
///
/// The slabs deliberately overlap. That is what keeps each one *maximal*, so an item that
/// straddles two former sub-regions can still find a space large enough to hold it --
/// the property a point-based anchor list cannot provide.
fn subtract(space: &Space, occupied: &Space) -> Vec<Space> {
    if !space.intersects(occupied) {
        return vec![*space];
    }

    let mut parts = Vec::with_capacity(6);
    let (sx1, sy1, sz1) = (
        space.x + space.width,
        space.y + space.length,
        space.z + space.depth,
    );
    let (ox1, oy1, oz1) = (
        occupied.x + occupied.width,
        occupied.y + occupied.length,
        occupied.z + occupied.depth,
    );

    if occupied.x > space.x {
        parts.push(Space {
            width: occupied.x - space.x,
            ..*space
        });
    }
    if ox1 < sx1 {
        parts.push(Space {
            x: ox1,
            width: sx1 - ox1,
            ..*space
        });
    }
    if occupied.y > space.y {
        parts.push(Space {
            length: occupied.y - space.y,
            ..*space
        });
    }
    if oy1 < sy1 {
        parts.push(Space {
            y: oy1,
            length: sy1 - oy1,
            ..*space
        });
    }
    if occupied.z > space.z {
        parts.push(Space {
            depth: occupied.z - space.z,
            ..*space
        });
    }
    if oz1 < sz1 {
        parts.push(Space {
            z: oz1,
            depth: sz1 - oz1,
            ..*space
        });
    }

    parts
}

/// Drops spaces too small to ever be useful, then any space contained in another.
///
/// Without this the space list grows without bound, which is the free-space equivalent of
/// the MVP never retiring a buried anchor point.
fn prune(spaces: Vec<Space>, min_extent: u32) -> Vec<Space> {
    let mut candidates: Vec<Space> = spaces
        .into_iter()
        .filter(|s| s.width >= min_extent && s.length >= min_extent && s.depth >= min_extent)
        .collect();

    // Largest first, so a space is usually compared against the containers already kept.
    candidates.sort_by(|a, b| {
        b.volume_mm3()
            .cmp(&a.volume_mm3())
            .then_with(|| (a.z, a.y, a.x).cmp(&(b.z, b.y, b.x)))
    });

    let mut kept: Vec<Space> = Vec::with_capacity(candidates.len());
    for space in candidates {
        // `contains` is inclusive, so this also removes exact duplicates.
        if kept.iter().any(|k| k.contains(&space)) {
            continue;
        }
        kept.retain(|k| !space.contains(k));
        kept.push(space);
    }
    kept
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constraints::CompatibilityPolicy;

    fn container(reference: &str, w: u32, l: u32, d: u32) -> Container {
        Container {
            reference: reference.to_string(),
            width: w,
            length: l,
            depth: d,
            max_weight: None,
            tare_weight: Some(0.0),
            active: true,
            max_containers: None,
        }
    }

    fn item(code: &str, w: u32, l: u32, d: u32, weight: f32) -> Item {
        Item {
            item_code: code.to_string(),
            item_reference: code.to_string(),
            width: w,
            length: l,
            depth: d,
            weight,
            compatibility_group: None,
            fragile: false,
            max_load_kg: None,
            orientation: Default::default(),
        }
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
    fn subtract_returns_the_original_when_disjoint() {
        let s = space(0, 0, 0, 100, 100, 100);
        let elsewhere = space(200, 200, 200, 50, 50, 50);
        assert_eq!(subtract(&s, &elsewhere), vec![s]);
    }

    #[test]
    fn subtract_a_corner_yields_three_maximal_slabs() {
        let s = space(0, 0, 0, 100, 100, 100);
        let corner = space(0, 0, 0, 40, 50, 60);
        let parts = subtract(&s, &corner);

        // Only the far side exists on each axis, so three slabs.
        assert_eq!(parts.len(), 3);
        assert!(parts.contains(&space(40, 0, 0, 60, 100, 100)));
        assert!(parts.contains(&space(0, 50, 0, 100, 50, 100)));
        assert!(parts.contains(&space(0, 0, 60, 100, 100, 40)));
    }

    #[test]
    fn subtracting_a_central_block_yields_six_slabs() {
        let s = space(0, 0, 0, 100, 100, 100);
        let middle = space(40, 40, 40, 20, 20, 20);
        assert_eq!(subtract(&s, &middle).len(), 6);
    }

    #[test]
    fn prune_drops_contained_and_undersized_spaces() {
        let big = space(0, 0, 0, 100, 100, 100);
        let inside = space(10, 10, 10, 10, 10, 10);
        let sliver = space(0, 0, 0, 100, 100, 2);

        let kept = prune(vec![big, inside, sliver], 5);
        assert_eq!(kept, vec![big]);
    }

    #[test]
    fn free_space_stays_bounded_as_items_are_added() {
        let mut free = vec![space(0, 0, 0, 1000, 1000, 1000)];
        for i in 0..20u32 {
            let occupied = space(i * 50, 0, 0, 50, 50, 50);
            free = subtract_all(&free, &occupied, 10);
        }
        // The MVP's anchor list grew by three every placement and never shrank.
        assert!(free.len() < 60, "free space list grew to {}", free.len());
    }

    #[test]
    fn picks_one_medium_carton_over_eight_small_ones() {
        let packer = Packer::new(vec![
            container("SML", 150, 150, 150),
            container("MED", 400, 400, 400),
        ]);
        let items: Vec<Item> = (1..=8)
            .map(|i| item(&format!("C{}", i), 140, 140, 140, 0.5))
            .collect();

        let solution = packer.pack(items).unwrap();
        assert!(solution.is_complete());
        assert_eq!(solution.container_count(), 1);
        assert_eq!(solution.containers[0].container.reference, "MED");
    }

    #[test]
    fn prefers_the_smallest_carton_that_holds_everything() {
        let packer = Packer::new(vec![
            container("SML", 150, 150, 150),
            container("MED", 400, 400, 400),
            container("LRG", 1200, 1200, 1200),
        ]);
        let solution = packer.pack(vec![item("ONE", 100, 100, 100, 1.0)]).unwrap();
        assert_eq!(solution.containers[0].container.reference, "SML");
    }

    #[test]
    fn fills_a_carton_exactly() {
        let packer = Packer::new(vec![container("SML", 150, 150, 150)]);
        let items: Vec<Item> = (1..=8)
            .map(|i| item(&format!("CUBE-{}", i), 75, 75, 75, 0.3))
            .collect();

        let solution = packer.pack(items).unwrap();
        assert_eq!(solution.container_count(), 1);
        assert_eq!(solution.packed_item_count(), 8);
        assert!((solution.utilisation() - 1.0).abs() < 1e-6);

        // Two layers of four, so both z levels are used.
        let zs: Vec<u32> = solution.containers[0]
            .placements
            .iter()
            .map(|p| p.z)
            .collect();
        assert!(zs.contains(&0) && zs.contains(&75));
    }

    #[test]
    fn never_leaves_an_item_floating() {
        let packer = Packer::new(vec![container("FLAT", 400, 400, 200)]);
        let solution = packer
            .pack(vec![
                item("BLOCK", 200, 200, 140, 1.0),
                item("PLATE", 350, 350, 30, 9.0),
            ])
            .unwrap();

        for c in &solution.containers {
            for p in &c.placements {
                let ratio = crate::constraints::support_ratio(c, &p.footprint());
                assert!(
                    ratio >= packer.constraints().min_support_ratio - 1e-6,
                    "{} supported at only {:.0}%",
                    p.item.item_code,
                    ratio * 100.0
                );
            }
        }
    }

    #[test]
    fn dangerous_goods_never_share_with_general_freight() {
        let packer = Packer::new(vec![container("MED", 400, 400, 400)]);
        let mut hazmat = item("HAZMAT", 100, 100, 100, 1.0);
        hazmat.compatibility_group = Some("DANGEROUS-GOODS".to_string());

        let solution = packer
            .pack(vec![item("GENERAL", 300, 300, 100, 1.0), hazmat])
            .unwrap();

        assert_eq!(solution.container_count(), 2);
        for c in &solution.containers {
            let groups: Vec<&str> = c
                .placements
                .iter()
                .map(|p| crate::constraints::group_key(&p.item))
                .collect();
            assert!(groups.windows(2).all(|w| w[0] == w[1]));
        }
    }

    #[test]
    fn respects_container_supply_limits() {
        let mut small = container("SML", 150, 150, 150);
        small.max_containers = Some(2);
        let packer = Packer::new(vec![small]);

        let items: Vec<Item> = (1..=3)
            .map(|i| item(&format!("C{}", i), 140, 140, 140, 0.5))
            .collect();

        let solution = packer.pack(items).unwrap();
        assert_eq!(solution.container_count(), 2);
        assert_eq!(solution.unpacked.len(), 1);
    }

    #[test]
    fn oversized_items_are_reported_not_fatal() {
        let packer = Packer::new(vec![container("SML", 150, 150, 150)]);
        let solution = packer
            .pack(vec![
                item("FITS", 100, 100, 100, 1.0),
                item("HUGE", 5000, 5000, 5000, 1.0),
            ])
            .unwrap();

        // The MVP aborted the whole order here.
        assert_eq!(solution.packed_item_count(), 1);
        assert_eq!(solution.unpacked.len(), 1);
        assert_eq!(solution.unpacked[0].item.item_code, "HUGE");
        assert!(solution.unpacked[0].reason.contains("does not fit"));
    }

    #[test]
    fn weight_limits_open_a_second_carton() {
        let mut c = container("MED", 400, 400, 400);
        c.max_weight = Some(10.0);
        let packer = Packer::new(vec![c]);

        let items: Vec<Item> = (1..=3)
            .map(|i| item(&format!("W{}", i), 100, 100, 100, 4.0))
            .collect();

        let solution = packer.pack(items).unwrap();
        assert_eq!(solution.container_count(), 2);
        for c in &solution.containers {
            assert!(c.gross_weight() <= 10.0);
        }
    }

    #[test]
    fn this_way_up_items_keep_their_vertical_axis() {
        let packer = Packer::new(vec![container("TALL", 300, 300, 400)]);
        let mut upright = item("UPRIGHT", 100, 200, 300, 1.0);
        upright.orientation = crate::types::Orientation::ThisWayUp;

        let solution = packer.pack(vec![upright]).unwrap();
        let placement = &solution.containers[0].placements[0];
        assert_eq!(placement.depth, 300);
    }

    #[test]
    fn fragile_items_are_not_crushed() {
        let packer = Packer::new(vec![container("MED", 400, 400, 400)]);
        let mut glass = item("GLASS", 400, 400, 100, 0.5);
        glass.fragile = true;

        let solution = packer
            .pack(vec![glass, item("ANVIL", 400, 400, 100, 20.0)])
            .unwrap();

        // Nothing may rest on the glass, so either it goes on top or they separate.
        for c in &solution.containers {
            if let Some(g) = c.placements.iter().find(|p| p.item.item_code == "GLASS") {
                assert!(
                    c.placements
                        .iter()
                        .all(|p| p.z < g.z + g.depth || p.item.item_code == "GLASS"),
                    "something was stacked on the fragile item"
                );
            }
        }
    }

    #[test]
    fn empty_input_is_an_empty_solution() {
        let packer = Packer::new(vec![container("SML", 150, 150, 150)]);
        let solution = packer.pack(vec![]).unwrap();
        assert!(solution.is_complete());
        assert_eq!(solution.container_count(), 0);
        assert_eq!(solution.utilisation(), 0.0);
    }

    #[test]
    fn inactive_containers_are_ignored() {
        let mut inactive = container("LRG", 1200, 1200, 1200);
        inactive.active = false;
        let packer = Packer::new(vec![inactive]);
        assert_eq!(
            packer.pack(vec![]).unwrap_err(),
            PackerError::NoActiveContainers
        );
    }

    #[test]
    fn zero_sized_items_are_rejected() {
        let packer = Packer::new(vec![container("SML", 150, 150, 150)]);
        let err = packer
            .pack(vec![item("FLAT", 100, 100, 0, 1.0)])
            .unwrap_err();
        assert!(matches!(err, PackerError::InvalidItem { .. }));
    }

    #[test]
    fn packing_is_deterministic() {
        let build = || {
            vec![
                item("A", 120, 80, 60, 1.0),
                item("B", 120, 80, 60, 1.0),
                item("C", 200, 100, 100, 2.0),
                item("D", 90, 90, 90, 0.5),
            ]
        };
        let packer = Packer::new(vec![
            container("SML", 150, 150, 150),
            container("MED", 400, 400, 400),
        ]);

        let first = packer.pack(build()).unwrap();
        let second = packer.pack(build()).unwrap();
        assert_eq!(
            serde_json::to_string(&first).unwrap(),
            serde_json::to_string(&second).unwrap()
        );
    }

    #[test]
    fn permissive_constraints_reproduce_mvp_grouping() {
        let packer =
            Packer::new(vec![container("MED", 400, 400, 400)]).with_constraints(ConstraintSet {
                compatibility: CompatibilityPolicy::UngroupedAreUniversal,
                min_support_ratio: 0.0,
                ..ConstraintSet::default()
            });
        let mut hazmat = item("HAZMAT", 100, 100, 100, 1.0);
        hazmat.compatibility_group = Some("DG".to_string());

        let solution = packer
            .pack(vec![item("GENERAL", 300, 300, 100, 1.0), hazmat])
            .unwrap();
        assert_eq!(solution.container_count(), 1);
    }

    #[test]
    fn no_placement_overlaps_another() {
        let packer = Packer::new(vec![container("MED", 400, 400, 400)]);
        let items: Vec<Item> = (1..=25)
            .map(|i| item(&format!("I{:02}", i), 90 + (i % 5) * 10, 80, 70, 0.4))
            .collect();

        let solution = packer.pack(items).unwrap();
        for c in &solution.containers {
            for (i, a) in c.placements.iter().enumerate() {
                for b in c.placements.iter().skip(i + 1) {
                    assert!(
                        !a.collides_with(b.x, b.y, b.z, b.width, b.length, b.depth),
                        "{} overlaps {}",
                        a.item.item_code,
                        b.item.item_code
                    );
                }
                assert!(a.x + a.width <= c.container.width);
                assert!(a.y + a.length <= c.container.length);
                assert!(a.z + a.depth <= c.container.depth);
            }
        }
    }
}
