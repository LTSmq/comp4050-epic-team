use serde::{Deserialize, Serialize};

use crate::types::{self, Container, Orientation, PackedContainer, Placement};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Item {
    pub item_code: String,
    pub item_reference: String,
    pub width: u32,
    pub length: u32,
    pub depth: u32,
    pub weight: f32,
    pub box_group: Option<String>,
}

impl Item {
    /// Safely computes volume in cm³ by casting to u64 internally to prevent multiplication overflow
    pub fn volume_cm3(&self) -> u32 {
        let raw_mm3 = self.width as u64 * self.length as u64 * self.depth as u64;
        (raw_mm3 / 1_000) as u32
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct BoxType {
    pub reference: String,
    pub width: u32,
    pub length: u32,
    pub depth: u32,
    pub max_weight: Option<f32>,
    #[serde(default)]
    pub box_weight: Option<f32>,
    #[serde(default = "default_active")]
    pub active: bool,
    pub maximum_boxes: Option<usize>,
}

fn default_active() -> bool {
    true
}

impl BoxType {
    /// Safely computes volume in cm³ by casting to u64 internally
    pub fn volume_cm3(&self) -> u32 {
        let raw_mm3 = self.width as u64 * self.length as u64 * self.depth as u64;
        (raw_mm3 / 1_000) as u32
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct PlacedItem {
    pub item: Item,
    pub x: u32,
    pub y: u32,
    pub z: u32,
    pub width: u32,
    pub length: u32,
    pub depth: u32,
}

impl PlacedItem {
    /// 3D Axis-Aligned Bounding Box (AABB) intersection check
    pub fn collides_with(&self, ox: u32, oy: u32, oz: u32, ow: u32, ol: u32, od: u32) -> bool {
        !(self.x + self.width <= ox
            || ox + ow <= self.x
            || self.y + self.length <= oy
            || oy + ol <= self.y
            || self.z + self.depth <= oz
            || oz + od <= self.z)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct PackedBox {
    pub box_index: usize,
    pub box_type: BoxType,
    pub placed_items: Vec<PlacedItem>,
}

impl PackedBox {
    pub fn new(box_index: usize, box_type: BoxType) -> Self {
        Self {
            box_index,
            box_type,
            placed_items: Vec::new(),
        }
    }

    pub fn current_items_weight(&self) -> f32 {
        self.placed_items.iter().map(|p| p.item.weight).sum()
    }

    pub fn gross_weight(&self) -> f32 {
        self.current_items_weight() + self.box_type.box_weight.unwrap_or(0.0)
    }

    pub fn assigned_box_group(&self) -> Option<String> {
        self.placed_items
            .iter()
            .find_map(|p| p.item.box_group.clone())
    }

    /// Rebuilds a carton the packer filled in the shape the API sends out. The
    /// packer does not number its cartons, so the caller says which one this is.
    pub fn from_packed(box_index: usize, packed: PackedContainer) -> Self {
        Self {
            box_index,
            box_type: packed.container.into(),
            placed_items: packed
                .placements
                .into_iter()
                .map(PlacedItem::from)
                .collect(),
        }
    }
}

// The types above are the wire format the portal and the visualiser read. The
// packer works in the ones in types.rs, so these conversions translate an order
// on the way in and a solution on the way out.
//
// The request schema has no fields yet for fragility, load limits or a fixed
// upright orientation, so every item arrives freely rotatable with those rules
// switched off. BoxGroup is the packer's compatibility group.
impl From<Item> for types::Item {
    fn from(item: Item) -> Self {
        Self {
            item_code: item.item_code,
            item_reference: item.item_reference,
            width: item.width,
            length: item.length,
            depth: item.depth,
            weight: item.weight,
            compatibility_group: item.box_group,
            fragile: false,
            max_load_kg: None,
            orientation: Orientation::Any,
        }
    }
}

impl From<types::Item> for Item {
    fn from(item: types::Item) -> Self {
        Self {
            item_code: item.item_code,
            item_reference: item.item_reference,
            width: item.width,
            length: item.length,
            depth: item.depth,
            weight: item.weight,
            box_group: item.compatibility_group,
        }
    }
}

impl From<BoxType> for Container {
    fn from(box_type: BoxType) -> Self {
        Self {
            reference: box_type.reference,
            width: box_type.width,
            length: box_type.length,
            depth: box_type.depth,
            max_weight: box_type.max_weight,
            tare_weight: box_type.box_weight,
            active: box_type.active,
            max_containers: box_type.maximum_boxes,
        }
    }
}

impl From<Container> for BoxType {
    fn from(container: Container) -> Self {
        Self {
            reference: container.reference,
            width: container.width,
            length: container.length,
            depth: container.depth,
            max_weight: container.max_weight,
            box_weight: container.tare_weight,
            active: container.active,
            maximum_boxes: container.max_containers,
        }
    }
}

impl From<Placement> for PlacedItem {
    fn from(placement: Placement) -> Self {
        Self {
            item: placement.item.into(),
            x: placement.x,
            y: placement.y,
            z: placement.z,
            width: placement.width,
            length: placement.length,
            depth: placement.depth,
        }
    }
}
