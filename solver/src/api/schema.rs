use serde::{Deserialize, Serialize};

use crate::models::{BoxType, Item, PackedBox};
use crate::{UnpackedItem, UnpackedReason};

/// An order in the solver's own original shape, with PascalCase keys at the top
/// as well as inside every item and carton.
///
/// The portal does not send this. It is kept because the example orders under
/// docs/example_data, the test pages and most of the tests are written in it,
/// and accepting it costs nothing next to the portal's shape below.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct PackingRequest {
    pub items: Vec<Item>,
    pub box_types: Vec<BoxType>,
    /// The caller's own name for this order. It comes back as the id on the
    /// solution, both on the reply and on the copy sent to the visualiser.
    ///
    /// The solver treats it as a label and nothing more. It is never read,
    /// stored, or checked for being unique. If a request arrives without one,
    /// the solver makes one up rather than sending out a solution nobody can
    /// identify.
    #[serde(default)]
    pub order_id: Option<String>,
}

/// An order as the portal sends it, which is the shape in
/// data_format_example/input_from_portal.json.
///
/// The keys at the top are lowercase while the items inside keep the solver's
/// PascalCase names, so the items are read with the same type as everywhere
/// else. Weight is required on every item, as it is in the older shape, because
/// carton weight limits mean nothing without it.
///
/// The portal's example has no list of cartons, but the solver keeps no carton
/// catalogue of its own, so every order has to say which cartons it may be
/// packed into. That list is boxTypes, and it is required.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortalOrder {
    /// The portal's name for this order. It becomes the id on the solution,
    /// which is how the visualiser and then the portal tell solutions apart.
    #[serde(default)]
    pub id: Option<String>,
    /// Where the order came from and how far along it is, such as Manual and
    /// Draft. The solver does not act on either; they are accepted so that an
    /// order the portal sends as is still parses.
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    pub items: Vec<Item>,
    pub box_types: Vec<BoxType>,
}

/// Either shape of order /solve accepts, already read and checked.
///
/// The two are told apart by the key their items sit under: the portal sends
/// items in lowercase, the older shape sends Items. Looking at that one key
/// first, rather than trying each shape in turn, means a mistake in an order
/// is reported against the shape it was meant to be instead of as a vague
/// failure to match either.
#[derive(Debug)]
pub struct SolveRequest {
    pub order_id: Option<String>,
    pub items: Vec<Item>,
    pub box_types: Vec<BoxType>,
}

impl SolveRequest {
    pub fn from_json(value: serde_json::Value) -> Result<Self, serde_json::Error> {
        if value.get("items").is_some() {
            let order: PortalOrder = serde_json::from_value(value)?;
            Ok(Self {
                order_id: order.id,
                items: order.items,
                box_types: order.box_types,
            })
        } else {
            let request: PackingRequest = serde_json::from_value(value)?;
            Ok(Self {
                order_id: request.order_id,
                items: request.items,
                box_types: request.box_types,
            })
        }
    }
}

/// A packing solution in the shape the visualiser asked for, which is the one in
/// data_format_example/solved_soltuion_example.json. This is both the reply to
/// /solve and the copy sent on to the visualiser.
///
/// It describes geometry and nothing else: each package is one carton, with its
/// inside dimensions as size and the items in it as a position and a size each.
/// All numbers are millimetres. The axes are the solver's own, so x is a
/// carton's Width, y its Length and z its Depth, and z is the vertical one.
///
/// Item codes, weights, groups and the carton's name are not part of a package.
///
/// The one addition to the visualiser's example is unpacked, the items that
/// fitted nowhere. Without it a partial solution looks exactly like a complete
/// one, so it is always present, and empty when everything was placed.
#[derive(Debug, Serialize)]
pub struct VisualizerSolution {
    pub id: String,
    pub packages: Vec<Package>,
    pub unpacked: Vec<UnpackedEntry>,
}

/// One item that was left out of every package, and why.
///
/// Unlike a packed item it has no position, and its size is as ordered rather
/// than rotated, since it was never placed. The item code and reference are
/// here so the sender can find the line in their order.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnpackedEntry {
    pub item_code: String,
    pub item_reference: String,
    pub size: Dimensions,
    pub weight: f32,
    /// A fixed code: TooLarge, TooHeavy, SupplyExhausted or CartonLimitReached.
    pub reason: UnpackedReason,
}

#[derive(Debug, Serialize)]
pub struct Package {
    pub size: Dimensions,
    pub items: Vec<PackageItem>,
}

#[derive(Debug, Serialize)]
pub struct PackageItem {
    /// The corner of the item nearest the carton's own origin.
    pub position: Dimensions,
    /// The item's extent after it was rotated to fit, not as it was ordered.
    pub size: Dimensions,
}

#[derive(Debug, Serialize)]
pub struct Dimensions {
    pub x: u32,
    pub y: u32,
    pub z: u32,
}

impl VisualizerSolution {
    pub fn new(id: String, packed_boxes: &[PackedBox], unpacked: &[UnpackedItem]) -> Self {
        let packages = packed_boxes
            .iter()
            .map(|packed| Package {
                size: Dimensions {
                    x: packed.box_type.width,
                    y: packed.box_type.length,
                    z: packed.box_type.depth,
                },
                items: packed
                    .placed_items
                    .iter()
                    .map(|placed| PackageItem {
                        position: Dimensions {
                            x: placed.x,
                            y: placed.y,
                            z: placed.z,
                        },
                        size: Dimensions {
                            x: placed.width,
                            y: placed.length,
                            z: placed.depth,
                        },
                    })
                    .collect(),
            })
            .collect();

        let unpacked = unpacked
            .iter()
            .map(|entry| UnpackedEntry {
                item_code: entry.item.item_code.clone(),
                item_reference: entry.item.item_reference.clone(),
                size: Dimensions {
                    x: entry.item.width,
                    y: entry.item.length,
                    z: entry.item.depth,
                },
                weight: entry.item.weight,
                reason: entry.reason,
            })
            .collect();

        Self {
            id,
            packages,
            unpacked,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct ErrorResponse {
    pub error: String,
}
