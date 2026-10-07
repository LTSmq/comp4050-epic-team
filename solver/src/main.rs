//! The HTTP server that exposes the packing solver over the network.
//! Start it with: cargo run
//!
//! The address to listen on comes from the LISTEN_ADDR environment variable,
//! falling back to DEFAULT_LISTEN_ADDR below when it is not set.
//!
//! The 0.0.0.0 in that default means "accept connections arriving on any
//! network interface". The alternative, 127.0.0.1, would accept connections
//! only from this machine. We want the wider setting because the warehouse
//! worker reaches this from their phone over the same network.

use std::env;

use tokio::net::TcpListener;

use solver::api::router::create_router;

const DEFAULT_LISTEN_ADDR: &str = "0.0.0.0:8080";

// This attribute starts the async runtime that the server needs. Marking main
// as async is not enough on its own.
#[tokio::main]
async fn main() {
    // Reading the variable fails when it simply is not set, which is the
    // normal case in development, so fall back instead of treating it as an
    // error.
    let listen_addr = env::var("LISTEN_ADDR").unwrap_or_else(|_| DEFAULT_LISTEN_ADDR.to_string());

    // Binding claims the address so the operating system sends matching
    // connections to us. It usually fails for one of two reasons: the address
    // is malformed, or another process already holds that port. The server
    // cannot do anything useful in either case, so stop here and name the
    // address that failed.
    let listener = TcpListener::bind(&listen_addr)
        .await
        .unwrap_or_else(|error| panic!("could not bind {listen_addr}: {error}"));

    // Print the address the listener actually got, not the one we asked for.
    // The two differ when the requested port is 0, which asks the operating
    // system to pick any free port, so this is the only way to find out which
    // port that turned out to be.
    match listener.local_addr() {
        Ok(address) => println!("solver listening on http://{address}"),
        Err(error) => println!("solver listening on {listen_addr} (address unavailable: {error})"),
    }

    // This runs until the process is stopped, so reaching the line after it
    // means the server itself failed.
    axum::serve(listener, create_router())
        .await
        .expect("server stopped unexpectedly");
}
