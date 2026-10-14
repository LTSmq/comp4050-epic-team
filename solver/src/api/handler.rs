use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

use crate::models::{BoxType, Item, PackedBox, PlacedItem};
use crate::types::{self, Container, Orientation, PackedContainer, Placement};
use crate::{Packer, UnpackedItem};
use super::delivery::Delivery;
use super::schema::{ErrorResponse, PackingRequest, PackingResponse};

/// How many packings this server has answered since it started. It exists only
/// to keep made up order identifiers apart: the clock alone is not enough,
/// because two requests can easily land in the same millisecond.
static SOLVE_COUNT: AtomicU64 = AtomicU64::new(0);

pub async fn solve_handler(
    State(delivery): State<Arc<Delivery>>,
    Json(request): Json<PackingRequest>,

) -> Result<Json<PackingResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Decide on the identifier first, before any packing happens. Doing it here
    // means the reply and both copies sent to the other teams all carry the same
    // one, which is the whole point of having it.
    let order_id = request.order_id.unwrap_or_else(generated_order_id);

    // The packer works in its own types, so the request is translated on the
    // way in and the solution on the way out. The wire format the portal and
    // the visualiser see does not change.
    //
    // The default constraint set keeps every BoxGroup in cartons of its own,
    // and treats items with no BoxGroup as one more group, so untagged items
    // never share a carton with tagged ones.
    let containers = request.box_types.into_iter().map(to_container).collect();
    let items = request.items.into_iter().map(to_packer_item).collect();

    // An error here means the request itself is unusable, such as no active
    // carton types or an item with a zero side, rather than items not fitting.
    let solution = Packer::new(containers).pack(items).map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: error.to_string() }),
        )
    })?;

    // Items that fit nowhere no longer sink the answer. They ride along on the
    // response as UnpackedItems and the cartons that were filled still go out,
    // which is what lets an order with one oversized line still be rendered.
    //
    // The one case left that is genuinely an error is a pack that filled no
    // carton at all while still holding items, because then there is no solution
    // to show anybody. An order with no items in it is not that case: it packs
    // nothing, has nothing left over, and is answered with an empty solution.
    if solution.containers.is_empty() && !solution.unpacked.is_empty()
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: nothing_packed_message(&solution.unpacked) }),
        ));
    }

    let response = PackingResponse {
        order_id,
        packed_boxes: solution
            .containers
            .into_iter()
            .enumerate()
            .map(|(index, packed)| to_packed_box(index, packed))
            .collect(),
        unpacked_items: solution
            .unpacked
            .into_iter()
            .map(|unpacked| to_api_item(unpacked.item))
            .collect(),
    };

    // Send copies on to the visualiser and the portal. This does not wait for
    // them to arrive, so it costs the caller nothing. They are getting this same
    // solution as their reply in a moment either way. A partial solution is sent
    // like any other: it is a real answer, and the unpacked list travels with it.
    delivery.send(&response);

    Ok(Json(response))
}

/// Explains a pack that placed nothing at all.
///
/// Naming an item is what makes the message worth reading, since it is usually
/// one obvious offender, and knowing which one tells the sender what to change.
/// The packer says why it gave up on each item, so that reason is passed on.
fn nothing_packed_message(unpacked: &[UnpackedItem]) -> String {
    let first = match unpacked.first() {
        Some(entry) => entry,
        // Unreachable: the caller only asks for this message when the list has
        // something in it. Worth handling anyway rather than risking a panic in
        // the middle of answering a request.
        None => return "Could not pack the order.".to_string(),
    };

    let named = format!("{} ({})", first.item.item_code, first.item.item_reference);
    let reason = &first.reason;

    if unpacked.len() == 1 {
        format!("Could not pack item {named}. It {reason}.")
    } else {
        format!(
            "Could not pack any of the {} items. The first that would not fit is {named}, which {reason}.",
            unpacked.len()
        )
    }
}

// The request schema has no fields yet for fragility, load limits or a fixed
// upright orientation, so every item arrives freely rotatable with those
// rules switched off. BoxGroup is the packer's compatibility group.
fn to_packer_item(item: Item) -> types::Item {
    types::Item {
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

fn to_api_item(item: types::Item) -> Item {
    Item {
        item_code: item.item_code,
        item_reference: item.item_reference,
        width: item.width,
        length: item.length,
        depth: item.depth,
        weight: item.weight,
        box_group: item.compatibility_group,
    }
}

fn to_container(box_type: BoxType) -> Container {
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

fn to_box_type(container: Container) -> BoxType {
    BoxType {
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

fn to_placed_item(placement: Placement) -> PlacedItem {
    PlacedItem {
        item: to_api_item(placement.item),
        x: placement.x,
        y: placement.y,
        z: placement.z,
        width: placement.width,
        length: placement.length,
        depth: placement.depth,
    }
}

fn to_packed_box(box_index: usize, packed: PackedContainer) -> PackedBox {
    PackedBox {
        box_index,
        box_type: to_box_type(packed.container),
        placed_items: packed.placements.into_iter().map(to_placed_item).collect(),
    }
}

/// Makes up an identifier for a request that did not bring one of its own.
///
/// The result looks like solve-1789195885725-0: the current time in
/// milliseconds, then a count of solves so far. It only needs to be different
/// every time, not meaningful. Anyone who wants a solution tied back to a real
/// order number should send OrderId on the request instead of relying on this.
fn generated_order_id() -> String {
    let milliseconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0);

    let count = SOLVE_COUNT.fetch_add(1, Ordering::Relaxed);

    format!("solve-{milliseconds}-{count}")
}

/// Answers GET /health with the text "ok" and a 200 status.
///
/// This exists so the frontend can check the solver is running without having
/// to send it a real packing request. It deliberately does no work: a reply
/// means the server is up and accepting requests, nothing more.
pub async fn health_handler() -> &'static str {
    "ok"
}
