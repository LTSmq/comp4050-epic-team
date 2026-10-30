use serde::{Deserialize, Serialize};

/// A packable item.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Item {
    pub item_code: String,
    pub item_reference: String,
    pub width: u32,
    pub length: u32,
    pub depth: u32,
    pub weight: f32,
    pub compatibility_group: Option<String>,
    #[serde(default)]
    pub fragile: bool,
    #[serde(default)]
    pub max_load_kg: Option<f32>,
    #[serde(default)]
    pub orientation: Orientation,
}

impl Item {
    /// Exact internal volume in mm^3.
    ///
    /// Packing calculations should use this instead of volume_cm3 so no
    /// precision is discarded.
    pub fn volume_mm3(&self) -> u64 {
        self.width as u64 * self.length as u64 * self.depth as u64
    }

    /// Convenience display conversion only.
    pub fn volume_cm3(&self) -> u64 {
        self.volume_mm3() / 1_000
    }

    pub fn effective_max_load(&self) -> f32 {
        if self.fragile {
            0.0
        } else {
            self.max_load_kg.unwrap_or(f32::INFINITY)
        }
    }

    /// Returns every unique orientation allowed for this item.
    pub fn allowed_orientations(&self) -> Vec<(u32, u32, u32)> {
        let candidates = [
            (self.width, self.length, self.depth),
            (self.width, self.depth, self.length),
            (self.length, self.width, self.depth),
            (self.length, self.depth, self.width),
            (self.depth, self.width, self.length),
            (self.depth, self.length, self.width),
        ];

        let mut orientations: Vec<(u32, u32, u32)> = match self.orientation {
            Orientation::Any => candidates.to_vec(),

            // The original depth axis remains vertical.
            // Rotation within the XY plane is still allowed.
            Orientation::ThisWayUp => candidates
                .into_iter()
                .filter(|(_, _, depth)| *depth == self.depth)
                .collect(),
        };

        // Cubes and square-prism items otherwise create duplicate rotations.
        orientations.sort_unstable();
        orientations.dedup();

        orientations
    }
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub enum Orientation {
    #[default]
    Any,
    ThisWayUp,
}

/// A container/carton type available for packing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Container {
    pub reference: String,
    pub width: u32,
    pub length: u32,
    pub depth: u32,
    pub max_weight: Option<f32>,
    #[serde(default)]
    pub tare_weight: Option<f32>,
    #[serde(default = "default_active")]
    pub active: bool,
    pub max_containers: Option<usize>,
}

fn default_active() -> bool {
    true
}

impl Container {
    pub fn volume_mm3(&self) -> u64 {
        self.width as u64 * self.length as u64 * self.depth as u64
    }

    pub fn volume_cm3(&self) -> u64 {
        self.volume_mm3() / 1_000
    }
}

/// An axis-aligned free rectangular region within a container, for
/// maximal-space-style packing search.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Space {
    pub x: u32,
    pub y: u32,
    pub z: u32,
    pub width: u32,
    pub length: u32,
    pub depth: u32,
}

impl Space {
    pub fn volume_mm3(&self) -> u64 {
        self.width as u64 * self.length as u64 * self.depth as u64
    }

    pub fn volume_cm3(&self) -> u64 {
        self.volume_mm3() / 1_000
    }

    pub fn fits(&self, width: u32, length: u32, depth: u32) -> bool {
        width <= self.width && length <= self.length && depth <= self.depth
    }

    /// True when this space has positive-volume intersection with another.
    pub fn intersects(&self, other: &Space) -> bool {
        let self_x2 = self.x as u64 + self.width as u64;
        let self_y2 = self.y as u64 + self.length as u64;
        let self_z2 = self.z as u64 + self.depth as u64;

        let other_x2 = other.x as u64 + other.width as u64;
        let other_y2 = other.y as u64 + other.length as u64;
        let other_z2 = other.z as u64 + other.depth as u64;

        (self.x as u64) < other_x2
            && (other.x as u64) < self_x2
            && (self.y as u64) < other_y2
            && (other.y as u64) < self_y2
            && (self.z as u64) < other_z2
            && (other.z as u64) < self_z2
    }

    /// Whether `other` lies completely inside this space.
    pub fn contains(&self, other: &Space) -> bool {
        let self_x2 = self.x as u64 + self.width as u64;
        let self_y2 = self.y as u64 + self.length as u64;
        let self_z2 = self.z as u64 + self.depth as u64;

        let other_x2 = other.x as u64 + other.width as u64;
        let other_y2 = other.y as u64 + other.length as u64;
        let other_z2 = other.z as u64 + other.depth as u64;

        other.x >= self.x
            && other.y >= self.y
            && other.z >= self.z
            && other_x2 <= self_x2
            && other_y2 <= self_y2
            && other_z2 <= self_z2
    }
}

/// An item placed at a resolved position and orientation within a container.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Placement {
    pub item: Item,
    pub x: u32,
    pub y: u32,
    pub z: u32,
    pub width: u32,
    pub length: u32,
    pub depth: u32,
}

impl Placement {
    /// 3D Axis-Aligned Bounding Box (AABB) intersection check
    pub fn collides_with(&self, ox: u32, oy: u32, oz: u32, ow: u32, ol: u32, od: u32) -> bool {
        let ax1 = self.x as u64;
        let ay1 = self.y as u64;
        let az1 = self.z as u64;

        let ax2 = ax1 + self.width as u64;
        let ay2 = ay1 + self.length as u64;
        let az2 = az1 + self.depth as u64;

        let bx1 = ox as u64;
        let by1 = oy as u64;
        let bz1 = oz as u64;

        let bx2 = bx1 + ow as u64;
        let by2 = by1 + ol as u64;
        let bz2 = bz1 + od as u64;

        ax1 < bx2 && bx1 < ax2 && ay1 < by2 && by1 < ay2 && az1 < bz2 && bz1 < az2
    }

    /// The space this placement occupies within its container.
    pub fn footprint(&self) -> Space {
        Space {
            x: self.x,
            y: self.y,
            z: self.z,
            width: self.width,
            length: self.length,
            depth: self.depth,
        }
    }
}

/// A container together with the items placed inside it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackedContainer {
    pub container: Container,
    pub placements: Vec<Placement>,
}

impl PackedContainer {
    pub fn new(container: Container) -> Self {
        Self {
            container,
            placements: Vec::new(),
        }
    }

    pub fn current_items_weight(&self) -> f32 {
        self.placements.iter().map(|p| p.item.weight).sum()
    }

    pub fn gross_weight(&self) -> f32 {
        self.current_items_weight() + self.container.tare_weight.unwrap_or(0.0)
    }

    pub fn used_volume_mm3(&self) -> u64 {
        self.placements
            .iter()
            .map(|placement| {
                placement.width as u64 * placement.length as u64 * placement.depth as u64
            })
            .sum()
    }

    pub fn assigned_compatibility_group(&self) -> Option<String> {
        self.placements
            .iter()
            .find_map(|p| p.item.compatibility_group.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_item(compatibility_group: Option<&str>) -> Item {
        Item {
            item_code: "ITM-001".to_string(),
            item_reference: "Widget".to_string(),
            width: 100,
            length: 200,
            depth: 50,
            weight: 1.5,
            compatibility_group: compatibility_group.map(|s| s.to_string()),
            fragile: false,
            max_load_kg: None,
            orientation: Orientation::Any,
        }
    }

    fn sample_container() -> Container {
        Container {
            reference: "MED".to_string(),
            width: 400,
            length: 400,
            depth: 400,
            max_weight: Some(15.0),
            tare_weight: Some(0.75),
            active: true,
            max_containers: None,
        }
    }

    #[test]
    fn item_volume_cm3() {
        let item = sample_item(None);
        // 100mm * 200mm * 50mm = 1_000_000 mm3 = 1_000 cm3
        assert_eq!(item.volume_cm3(), 1_000);
    }

    #[test]
    fn container_volume_cm3() {
        let container = sample_container();
        // 400mm^3 = 64_000_000 mm3 = 64_000 cm3
        assert_eq!(container.volume_cm3(), 64_000);
    }

    #[test]
    fn space_volume_cm3() {
        let space = Space {
            x: 0,
            y: 0,
            z: 0,
            width: 100,
            length: 100,
            depth: 100,
        };
        assert_eq!(space.volume_cm3(), 1_000);
    }

    #[test]
    fn space_fits() {
        let space = Space {
            x: 0,
            y: 0,
            z: 0,
            width: 100,
            length: 200,
            depth: 50,
        };
        assert!(space.fits(100, 200, 50));
        assert!(space.fits(50, 100, 25));
        assert!(!space.fits(101, 200, 50));
        assert!(!space.fits(100, 201, 50));
        assert!(!space.fits(100, 200, 51));
    }

    #[test]
    fn placement_collides_with_overlapping() {
        let placement = Placement {
            item: sample_item(None),
            x: 0,
            y: 0,
            z: 0,
            width: 100,
            length: 100,
            depth: 100,
        };
        assert!(placement.collides_with(50, 50, 50, 100, 100, 100));
    }

    #[test]
    fn placement_collides_with_non_overlapping() {
        let placement = Placement {
            item: sample_item(None),
            x: 0,
            y: 0,
            z: 0,
            width: 100,
            length: 100,
            depth: 100,
        };
        assert!(!placement.collides_with(100, 0, 0, 100, 100, 100));
    }

    #[test]
    fn placement_footprint_matches_position_and_size() {
        let placement = Placement {
            item: sample_item(None),
            x: 10,
            y: 20,
            z: 30,
            width: 40,
            length: 50,
            depth: 60,
        };
        let space = placement.footprint();
        assert_eq!(
            space,
            Space {
                x: 10,
                y: 20,
                z: 30,
                width: 40,
                length: 50,
                depth: 60,
            }
        );
    }

    #[test]
    fn packed_container_weight_and_group_aggregation() {
        let mut packed = PackedContainer::new(sample_container());
        assert_eq!(packed.gross_weight(), 0.75);
        assert_eq!(packed.assigned_compatibility_group(), None);

        packed.placements.push(Placement {
            item: sample_item(Some("GROUP-A")),
            x: 0,
            y: 0,
            z: 0,
            width: 100,
            length: 200,
            depth: 50,
        });

        assert_eq!(packed.current_items_weight(), 1.5);
        assert_eq!(packed.gross_weight(), 2.25);
        assert_eq!(
            packed.assigned_compatibility_group(),
            Some("GROUP-A".to_string())
        );
    }
}
