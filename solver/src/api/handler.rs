use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

use crate::{Item, Solver};
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

    let solver = Solver::new(request.box_types);
    let outcome = solver.pack(request.items);

    // Items that fit nowhere no longer sink the answer. They ride along on the
    // response as UnpackedItems and the cartons that were filled still go out,
    // which is what lets an order with one oversized line still be rendered.
    //
    // The one case left that is genuinely an error is a pack that filled no
    // carton at all while still holding items, because then there is no solution
    // to show anybody. An order with no items in it is not that case: it packs
    // nothing, has nothing left over, and is answered with an empty solution.
    if outcome.packed_boxes.is_empty() && !outcome.unpacked_items.is_empty()
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: nothing_packed_message(&outcome.unpacked_items) }),
        ));
    }

    let response = PackingResponse {
        order_id,
        packed_boxes: outcome.packed_boxes,
        unpacked_items: outcome.unpacked_items,
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
fn nothing_packed_message(unpacked_items: &[Item]) -> String {
    let first = match unpacked_items.first() {
        Some(item) => item,
        // Unreachable: the caller only asks for this message when the list has
        // something in it. Worth handling anyway rather than risking a panic in
        // the middle of answering a request.
        None => return "Could not pack the order.".to_string(),
    };

    let named = format!("{} ({})", first.item_code, first.item_reference);
    let reason = "exceeds the dimensional boundaries or weight limits of every carton type offered";

    if unpacked_items.len() == 1 {
        format!("Could not pack item {named}. It {reason}.")
    } else {
        format!(
            "Could not pack any of the {} items. The first that would not fit is {named}, which {reason}.",
            unpacked_items.len()
        )
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
