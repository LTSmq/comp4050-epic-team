//! Application authentication for website-to-solver requests.

use axum::{
    Json,
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use subtle::ConstantTimeEq;

// Deliberately has no Debug implementation: never print the credential.
#[derive(Clone)]
pub struct SolverAuth(String);

impl SolverAuth {
    /// No default credential and no unauthenticated development mode.
    pub fn from_env() -> Result<Self, &'static str> {
        let token =
            std::env::var("SOLVER_AUTH_TOKEN").map_err(|_| "SOLVER_AUTH_TOKEN must be set")?;
        Self::new(token)
    }

    pub fn new(token: String) -> Result<Self, &'static str> {
        if !(32..=256).contains(&token.len())
            || !token
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"-._~+/=".contains(&c))
        {
            return Err("SOLVER_AUTH_TOKEN must contain 32-256 ASCII bearer-token characters");
        }
        Ok(Self(token))
    }

    fn accepts(&self, request: &Request) -> bool {
        let mut values = request.headers().get_all(header::AUTHORIZATION).iter();
        let Some(value) = values.next() else {
            return false;
        };
        // Avoid ambiguous credentials, including combined header values.
        if values.next().is_some() {
            return false;
        }
        let Ok(value) = value.to_str() else {
            return false;
        };
        let Some((scheme, token)) = value.split_once(' ') else {
            return false;
        };
        scheme.eq_ignore_ascii_case("Bearer")
            && bool::from(token.as_bytes().ct_eq(self.0.as_bytes()))
    }
}

/// Runs before JSON extraction, packing, or any solution delivery.
pub async fn require_solver_auth(
    State(auth): State<SolverAuth>,
    request: Request,
    next: Next,
) -> Response {
    if !auth.accepts(&request) {
        return (
            StatusCode::UNAUTHORIZED,
            [(header::WWW_AUTHENTICATE, "Bearer")],
            Json(serde_json::json!({ "Error": "Unauthorized" })),
        )
            .into_response();
    }
    next.run(request).await
}
