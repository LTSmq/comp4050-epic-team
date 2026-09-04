use solver::api::router::create_router;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    let app = create_router();

    let listener = TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("Failed to start solver API");

    println!("Solver API running on http://127.0.0.1:8080");

    axum::serve(listener, app)
        .await
        .expect("Solver API failed");
}
