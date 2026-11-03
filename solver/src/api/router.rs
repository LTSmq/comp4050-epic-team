//! The list of URLs the server answers on, and the middleware applied to them.

use std::sync::Arc;

use super::auth::{SolverAuth, require_solver_auth};
use super::delivery::Delivery;
use super::handler::{health_handler, solve_handler};
use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware,
    routing::{get, post},
};

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
    let auth = SolverAuth::from_env().expect("invalid solver authentication configuration");
    create_router_with(Arc::new(Delivery::from_env()), auth)
}

/// The same table, with explicit delivery and authentication configuration
/// instead of reading the environment.
///
/// This is for the tests. They start a small server of their own and point the
/// solver at it, which is how we can check that solutions really do go out
/// without needing the visualiser running anywhere.
pub fn create_router_with(delivery: Arc<Delivery>, auth: SolverAuth) -> Router {
    // Only Next.js calls /solve. Browser access and CORS are unnecessary;
    // authentication is enforced regardless of the request's Origin header.
    Router::new()
        .route("/solve", post(solve_handler))
        .route_layer(middleware::from_fn_with_state(auth, require_solver_auth))
        .route("/health", get(health_handler))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .with_state(delivery)
}
