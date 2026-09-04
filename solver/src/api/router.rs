use axum::{
    routing::post,
    Router,
};

use super::handler::solve_handler;

pub fn create_router() -> Router
{
    Router::new()
        .route("/solve", post(solve_handler))
}

