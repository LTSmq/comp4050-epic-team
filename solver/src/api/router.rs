//! The list of URLs the server answers on, and the middleware applied to them.

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;

use super::handler::{health_handler, solve_handler};

/// Builds the table that maps each URL and HTTP method to the function that
/// handles it. GET /health reports that the server is up; POST /solve does the
/// packing work.
pub fn create_router() -> Router
{
    // A browser refuses to let a page on one site read a response from a
    // different site unless that site says it is allowed. Saying so is what
    // CORS headers do, and adding this layer attaches them to every response
    // below it.
    //
    // Permissive means "allow any site", which is convenient while the
    // frontend is still being developed and moving between addresses. Before
    // this server is reachable from outside a local network, replace it with
    // the specific addresses the portal and visualiser are served from.
    Router::new()
        .route("/solve", post(solve_handler))
        .route("/health", get(health_handler))
        .layer(CorsLayer::permissive())
}
