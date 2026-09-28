use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AnchorPoint {
    pub x: u32,
    pub y: u32,
    pub z: u32,
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
}