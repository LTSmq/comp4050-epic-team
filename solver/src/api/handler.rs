use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{Json, extract::State, http::StatusCode};

use super::delivery::Delivery;
use super::schema::{ErrorResponse, SolveRequest, VisualizerSolution};
use crate::models::PackedBox;
use crate::{Packer, PackerConfig, SortRule, UnpackedItem};

/// The most items one order may carry. Packing time grows faster than the
/// item count, and nothing else stops a single order of a million tiny items
/// from keeping the server busy for hours. 10,000 is the largest order the load
/// tests in data_format_example/generated have verified, which took about 39
/// seconds in a debug build, so anything bigger is refused rather than tried.
pub const MAX_ITEMS: usize = 10_000;

/// The most carton types one order may offer. Every item is trial packed into
/// every type, so a long list multiplies the work just as more items do. Real
/// orders offer a handful; this leaves plenty of room above that.
pub const MAX_BOX_TYPES: usize = 100;

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
            Json(ErrorResponse {
                error: format!("The order could not be read: {error}"),
            }),
        )
    })?;

    // An order too big to pack in reasonable time is a 413, the same answer a
    // body over the size limit gets, so a caller can tell "split this order"
    // apart from "fix this field".
    if let Some(message) = too_large_message(request.items.len(), request.box_types.len()) {
        return Err((
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(ErrorResponse { error: message }),
        ));
    }

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

    // Packing is pure computation with no waiting in it, so run on the server's
    // own threads it would hold one for the whole solve. Those threads answer
    // every request, so a few large orders at once would stall all of them,
    // health checks included, and a host that restarts services failing their
    // health check would restart this one mid solve. The blocking pool is a
    // separate set of threads meant for exactly this kind of work.
    let solution = tokio::task::spawn_blocking(move || packer.pack(items))
        .await
        .map_err(|error| {
            // The pack panicked. That is a bug in the solver, not in the order.
            eprintln!("order {order_id}: the packer stopped unexpectedly: {error}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "The solver failed while packing this order.".to_string(),
                }),
            )
        })?
        .map_err(|error| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: error.to_string(),
                }),
            )
        })?;

    // The one packing outcome that is an error is a pack that filled no carton
    // at all while still holding items, because then there is no solution to
    // show anybody. An order with no items in it is not that case: it packs
    // nothing, has nothing left over, and is answered with an empty solution.
    if solution.containers.is_empty() && !solution.unpacked.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: nothing_packed_message(&solution.unpacked),
            }),
        ));
    }

    // Leftovers go out on the solution's unpacked list with a reason code. They
    // are logged as well, so the server's own output shows a partial solution
    // for what it is without anyone having to read the response.
    for unpacked in &solution.unpacked {
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

    let response = VisualizerSolution::new(order_id, &packed_boxes, &solution.unpacked);

    // Send a copy on to the visualiser. This does not wait for it to arrive, so
    // it costs the caller nothing.
    delivery.send(&response);

    Ok(Json(response))
}

/// Says what is wrong with an order over the size limits, or nothing if it is
/// within them. The message gives the limit, so the sender knows how far to
/// split the order.
fn too_large_message(item_count: usize, box_type_count: usize) -> Option<String> {
    if item_count > MAX_ITEMS {
        Some(format!(
            "The order has {item_count} items, more than the {MAX_ITEMS} the solver accepts in one request. Split it into smaller orders."
        ))
    } else if box_type_count > MAX_BOX_TYPES {
        Some(format!(
            "The order offers {box_type_count} carton types, more than the {MAX_BOX_TYPES} the solver accepts in one request."
        ))
    } else {
        None
    }
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
