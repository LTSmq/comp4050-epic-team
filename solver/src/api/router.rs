//! The list of URLs the server answers on, and the middleware applied to them.

use std::sync::Arc;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{get, post},
};
use tower_http::cors::CorsLayer;

use super::delivery::Delivery;
use super::handler::{health_handler, solve_handler};

/// The largest request body /solve will read, in bytes. A body over it is
/// answered 413 before any of it is parsed.
///
/// The framework's own default is 2 MB, which nobody chose and which the
/// 10,000 item load test order, at 1.8 MB, only just fits under. 4 MB leaves
/// room for an order at the item limit written with longer names or more
/// indentation, while still refusing a body far bigger than any order the
/// solver would agree to pack.
pub const MAX_BODY_BYTES: usize = 4 * 1024 * 1024;

/// Builds the table that says which function answers which URL, and works out
/// where finished solutions should be sent by reading the environment. This is
/// the version the real server uses.
pub fn create_router() -> Router {
    create_router_with(Arc::new(Delivery::from_env()))
}

/// The same table, but told directly where to send solutions instead of reading
/// the environment.
///
/// This is for the tests. They start a small server of their own and point the
/// solver at it, which is how we can check that solutions really do go out
/// without needing the visualiser running anywhere.
pub fn create_router_with(delivery: Arc<Delivery>) -> Router {
    // A browser refuses to let a page on one site read a response from a
    // different site unless that site says it is allowed. Saying so is what
    // CORS headers do, and adding this layer attaches them to every response
    // below it.
    //
    // Permissive means "allow any site", which is convenient while the
    // frontend is still being developed and moving between addresses. Before
    // this server is reachable from outside a local network, replace it with
    // the specific addresses the portal and visualiser are served from.
    //
    // Worth clearing up, because it comes up every time: none of this affects
    // the copy we send out to the visualiser. CORS is a rule browsers apply to
    // the pages they are running. When this server sends a solution to the
    // visualiser, no browser is involved, so CORS never enters into it.
    Router::new()
        .route("/solve", post(solve_handler))
        .route("/health", get(health_handler))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(CorsLayer::permissive())
        .with_state(delivery)
}
