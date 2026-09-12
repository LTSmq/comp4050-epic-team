use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

use crate::Solver;
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

    match solver.pack(request.items)
    {
        Ok(packed_boxes) => {
            let response = PackingResponse {
                order_id,
                packed_boxes,
            };

            // Send copies on to the visualiser and the portal. This does not
            // wait for them to arrive, so it costs the caller nothing. They are
            // getting this same solution as their reply in a moment either way.
            delivery.send(&response);

            Ok(Json(response))
        }

        // Nothing is sent to the other teams when packing fails, and that is a
        // known gap rather than a decision we are happy with. One item that fits
        // nowhere currently throws away every carton that had already been
        // packed successfully, so there is no partial solution left to pass on.
        // When that is fixed, this is where those copies would go out.
        Err(error) => Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error }),
        )),
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
