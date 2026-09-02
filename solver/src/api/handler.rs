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

