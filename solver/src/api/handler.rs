use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

use crate::models::PackedBox;
use crate::{Packer, PackerConfig, SortRule, UnpackedItem};
use super::delivery::Delivery;
use super::schema::{ErrorResponse, SolveRequest, VisualizerSolution};

/// How many packings this server has answered since it started. It exists only
/// to keep made up order identifiers apart: the clock alone is not enough,
/// because two requests can easily land in the same millisecond.
static SOLVE_COUNT: AtomicU64 = AtomicU64::new(0);

pub async fn solve_handler(
    State(delivery): State<Arc<Delivery>>,
    Json(body): Json<serde_json::Value>,

) -> Result<Json<VisualizerSolution>, (StatusCode, Json<ErrorResponse>)> {
    // The body is read as plain JSON first and only then as an order, because
    // an order can arrive in either of two shapes and the handler has to look
    // before it knows which one to read. A body that is JSON but not a usable
    // order of either shape, such as one missing Weight or boxTypes, is a 422.
    let request = SolveRequest::from_json(body).map_err(|error| {
        (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ErrorResponse { error: format!("The order could not be read: {error}") }),
        )
    })?;

    // Decide on the identifier first, before any packing happens, so the reply
    // and the copy sent to the visualiser carry the same one.
    let order_id = request.order_id.unwrap_or_else(generated_order_id);

    // The packer works in its own types, so the request is translated on the
    // way in and the solution on the way out.
    //
    // The default constraint set keeps every BoxGroup in cartons of its own,
    // and treats items with no BoxGroup as one more group, so untagged items
    // never share a carton with tagged ones.
    let containers = request.box_types.into_iter().map(Into::into).collect();
    let items: Vec<_> = request.items.into_iter().map(Into::into).collect();

    // An error here means the request itself is unusable, such as no active
    // carton types or an item with a zero side, rather than items not fitting.
    // Large orders use a single deterministic packing pass to avoid the cost of
    // repeating the same search across all sort rules. Profiling showed that the
    // additional passes dominate solve time once orders reach this size.
    let packer = if items.len() >= 500 {
        Packer::new(containers).with_config(PackerConfig {
            sort_rules: vec![SortRule::VolumeDesc],
            ..PackerConfig::default()
        })
    } else {
        Packer::new(containers)
    };

    let solution = packer.pack(items).map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: error.to_string() }),
        )
    })?;

    // The one packing outcome that is an error is a pack that filled no carton
    // at all while still holding items, because then there is no solution to
    // show anybody. An order with no items in it is not that case: it packs
    // nothing, has nothing left over, and is answered with an empty solution.
    if solution.containers.is_empty() && !solution.unpacked.is_empty()
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: nothing_packed_message(&solution.unpacked) }),
        ));
    }

    // The visualiser's shape has nowhere to put items that fitted nowhere, so a
    // partial solution goes out looking complete. The log is the only place
    // left that says otherwise, which is why each one is named here.
    for unpacked in &solution.unpacked
    {
        eprintln!(
            "order {order_id}: item {} ({}) was not packed, it {}",
            unpacked.item.item_code, unpacked.item.item_reference, unpacked.reason
        );
    }

    let packed_boxes: Vec<PackedBox> = solution
        .containers
        .into_iter()
        .enumerate()
        .map(|(index, packed)| PackedBox::from_packed(index, packed))
        .collect();

    let response = VisualizerSolution::new(order_id, &packed_boxes);

    // Send a copy on to the visualiser. This does not wait for it to arrive, so
    // it costs the caller nothing.
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

/// Makes up an identifier for a request that did not bring one of its own.
///
/// The result looks like solve-1789195885725-0: the current time in
/// milliseconds, then a count of solves so far. It only needs to be different
/// every time, not meaningful. Anyone who wants a solution tied back to a real
/// order number should send id, or OrderId in the older shape, instead of
/// relying on this.
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
