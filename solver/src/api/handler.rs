use axum::{Json, http::StatusCode};

use super::schema::{ErrorResponse, PackingRequest, PackingResponse};

use crate::models::{
    BoxType as LegacyBoxType, Item as LegacyItem, PackedBox as LegacyPackedBox,
    PlacedItem as LegacyPlacedItem,
};

use crate::types::{Container, Item, Orientation, PackedContainer, Placement};

use crate::Packer;

/// Converts the existing API item format into the new solver item format.

///

/// For now:

/// - BoxGroup becomes CompatibilityGroup.

/// - Existing API items are freely rotatable.

/// - Fragility/load-bearing fields default to disabled because the legacy

///   request schema does not expose them yet.

fn to_solver_item(item: LegacyItem) -> Item {
    Item {
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

/// Converts an existing API box type into the new solver container type.

fn to_solver_container(box_type: LegacyBoxType) -> Container {
    Container {
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

/// Converts the new item representation back into the existing API format.

fn to_legacy_item(item: Item) -> LegacyItem {
    LegacyItem {
        item_code: item.item_code,

        item_reference: item.item_reference,

        width: item.width,

        length: item.length,

        depth: item.depth,

        weight: item.weight,

        box_group: item.compatibility_group,
    }
}

/// Converts the new container representation back into the existing API format.

fn to_legacy_box_type(container: Container) -> LegacyBoxType {
    LegacyBoxType {
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

/// Converts one placement produced by the new engine into the existing API format.

fn to_legacy_placed_item(placement: Placement) -> LegacyPlacedItem {
    LegacyPlacedItem {
        item: to_legacy_item(placement.item),

        x: placement.x,

        y: placement.y,

        z: placement.z,

        width: placement.width,

        length: placement.length,

        depth: placement.depth,
    }
}

/// Converts one packed container produced by the new engine into the existing

/// PackedBox API representation.

fn to_legacy_packed_box(packed: PackedContainer, box_index: usize) -> LegacyPackedBox {
    LegacyPackedBox {
        box_index,

        box_type: to_legacy_box_type(packed.container),

        placed_items: packed
            .placements
            .into_iter()
            .map(to_legacy_placed_item)
            .collect(),
    }
}

pub async fn solve_handler(
    Json(request): Json<PackingRequest>,
) -> Result<Json<PackingResponse>, (StatusCode, Json<ErrorResponse>)> {
    let containers: Vec<Container> = request
        .box_types
        .into_iter()
        .map(to_solver_container)
        .collect();

    let items: Vec<Item> = request.items.into_iter().map(to_solver_item).collect();

    let packer = Packer::new(containers);

    let solution = packer.pack(items).map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: error.to_string(),
            }),
        )
    })?;

    /*

    * IMPORTANT:

    *

    * The existing PackingResponse only appears to expose PackedBoxes.

    * Until schema.rs is upgraded to expose UnpackedItems as well, preserve

    * the existing behaviour and reject an incomplete solution rather than

    * silently pretending every item was packed.

    */

    if !solution.unpacked.is_empty() {
        let description = solution
            .unpacked
            .iter()
            .map(|entry| {
                format!(
                    "{} ({}): {}",
                    entry.item.item_code, entry.item.item_reference, entry.reason
                )
            })
            .collect::<Vec<_>>()
            .join("; ");

        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!(
                    "Packing was incomplete. {} item(s) could not be packed: {}",
                    solution.unpacked.len(),
                    description
                ),
            }),
        ));
    }

    let packed_boxes = solution
        .containers
        .into_iter()
        .enumerate()
        .map(|(index, packed)| to_legacy_packed_box(packed, index))
        .collect();

    Ok(Json(PackingResponse { packed_boxes }))
}

/// Answers GET /health with "ok".

pub async fn health_handler() -> &'static str {
    "ok"
}
