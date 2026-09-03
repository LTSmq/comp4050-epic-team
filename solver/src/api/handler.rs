use axum::{
    http::StatusCode,
    Json,
};

use crate::Solver;
use super::schema::{ErrorResponse, PackingRequest, PackingResponse};

pub async fn solve_handler(
    Json(request): Json<PackingRequest>,

) -> Result<Json<PackingResponse>, (StatusCode, Json<ErrorResponse>)> {
    let solver = Solver::new(request.box_types);

    match solver.pack(request.items)
    {
        Ok(packed_boxes) => Ok(Json(PackingResponse{
            packed_boxes,
        })),

        Err(error) => Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error }),
        )),
    }
}

/// Answers GET /health with the text "ok" and a 200 status.
///
/// This exists so the frontend can check the solver is running without having
/// to send it a real packing request. It deliberately does no work: a reply
/// means the server is up and accepting requests, nothing more.
pub async fn health_handler() -> &'static str {
    "ok"
}

