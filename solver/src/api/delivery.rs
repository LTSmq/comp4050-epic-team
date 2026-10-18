//! Sending a finished packing solution on to the visualiser team.
//!
//! Everywhere else, the solver waits to be asked: someone sends it a request and
//! it sends an answer straight back. This module is the one exception. Once a
//! solution is ready we also push a copy of it to the visualiser, which draws
//! the cartons on screen and then passes the solution on to the portal. That is
//! the Sprint 2 data flow in docs/diagram.md at the top of this repository. The
//! solver sends nothing to the portal itself; under Sprint 1 it did, and that
//! second copy was removed when the visualiser took over relaying it.
//!
//! We are not told at compile time where the visualiser is. Its address comes
//! from an environment variable, which is a setting you put in front of the
//! command when you start the server:
//!
//!   VISUALIZER_URL   where to send each solution
//!
//! Leaving it out is fine, and is the normal way to work right now, because the
//! visualiser team has not given us an address yet. With it unset, the solver
//! sends nothing anywhere and behaves exactly as it did before this file
//! existed. That is on purpose: nobody should need the visualiser running just
//! to work on the packing code.
//!
//! One limitation worth knowing about: addresses starting with http work, and
//! addresses starting with https do not, because this build has no support for
//! encrypted connections. That was a deliberate trade. The library that adds it
//! has to be compiled from C source, so it needs cmake and a C compiler
//! installed, and every teammate would need those just to build the project.
//! While all three teams are on the same local network there is nothing to
//! encrypt, so it is not worth the cost yet. When the visualiser hands over an
//! https address, adding it back is a single line in Cargo.toml: give the
//! reqwest dependency the rustls feature. Until then, an https address is
//! called out when the server starts, so it is obvious rather than failing
//! silently on every solve.

use std::env;
use std::sync::Arc;
use std::time::Duration;

use super::schema::VisualizerSolution;

/// How long to wait for the visualiser to answer before giving up on it. Ten
/// seconds is generous for a server on the same network, so anything slower
/// than this is almost certainly down rather than busy. Nothing is lost by
/// giving up either, because the person who asked for this packing already has
/// their answer.
const DELIVERY_TIMEOUT: Duration = Duration::from_secs(10);

/// Where the visualiser is, if anywhere, and the client that sends to it.
///
/// A client here is the sending counterpart of a server. We build one and reuse
/// it for every delivery rather than making a fresh one each time, because it
/// keeps its network connections open between requests and reusing those is
/// faster than opening a new one for every solution.
#[derive(Debug)]
pub struct Delivery {
    client: reqwest::Client,
    visualizer_url: Option<String>,
}

impl Delivery {
    /// Works out where to send solutions by reading VISUALIZER_URL, as described
    /// at the top of this file. This is what the real server uses when it
    /// starts.
    ///
    /// A variable that was never set counts as "do not send". So does one that
    /// is set to an empty value, which matters more than it sounds: people blank
    /// out a setting far more often than they delete it, and a blank address is
    /// not something we could send to anyway.
    pub fn from_env() -> Self {
        // PORTAL_URL used to receive a second copy. Anyone still starting the
        // server with it set is told it now does nothing, rather than left
        // wondering why the portal hears nothing directly.
        if env::var("PORTAL_URL").is_ok_and(|url| !url.trim().is_empty()) {
            eprintln!(
                "note: PORTAL_URL is set but no longer used. Solutions go to the visualiser \
                 only, and the visualiser passes them on to the portal."
            );
        }

        let visualizer_url = match env::var("VISUALIZER_URL") {
            Ok(url) if !url.trim().is_empty() => {
                let url = url.trim().to_string();

                // Flagged now, while somebody is watching the server start up,
                // rather than leaving it to fail once per solve in a log nobody
                // is reading.
                if url.starts_with("https://") {
                    eprintln!(
                        "warning: VISUALIZER_URL is an https address and this build has no TLS, \
                         so every delivery to the visualizer will fail. See the note at the top \
                         of src/api/delivery.rs."
                    );
                }

                println!("solutions will be sent to the visualizer at {url}");
                Some(url)
            }
            _ => {
                println!("no VISUALIZER_URL set, so nothing will be sent to the visualizer");
                None
            }
        };

        Self::new(visualizer_url)
    }

    /// Builds the same thing, but with the visualiser's address handed in
    /// directly instead of read from the environment.
    ///
    /// The running server always uses from_env above. This version exists for
    /// the tests, which start a little server of their own and need to point the
    /// solver at it.
    pub fn new(visualizer_url: Option<String>) -> Self {
        // The time limit is set here, on the client, so that every delivery it
        // ever makes carries it. Without one, a visualiser that accepts our
        // connection and then goes quiet would leave us waiting on it forever,
        // and the piece of work doing the waiting would never be cleaned up.
        let client = reqwest::Client::builder()
            .timeout(DELIVERY_TIMEOUT)
            .build()
            .expect("could not build the HTTP client for sending solutions");

        Self { client, visualizer_url }
    }

    /// True when there is nowhere to send solutions. That is the normal state
    /// while the visualiser team has not given us an address, so it is worth
    /// being able to ask rather than guess.
    pub fn is_idle(&self) -> bool {
        self.visualizer_url.is_none()
    }

    /// Starts sending this solution to the visualiser, and returns immediately
    /// without waiting for it to answer.
    ///
    /// Not waiting is the important part. The delivery is handed to the runtime
    /// as a separate piece of work that carries on in the background, so the
    /// person who asked for this packing gets their answer at once instead of
    /// sitting behind a slow visualiser. Picture a warehouse worker holding
    /// their phone: their screen should not be waiting on somebody else's
    /// server.
    ///
    /// The trade is that we never find out here whether the delivery worked. A
    /// failure is printed and that copy is gone. Nothing is stored and nothing
    /// is tried again, because the solver keeps no record of past solutions to
    /// try again from. If a guaranteed handover is ever needed, that is a bigger
    /// change than this function.
    pub fn send(self: &Arc<Self>, solution: &VisualizerSolution) {
        let Some(url) = self.visualizer_url.clone() else {
            return;
        };

        let body = match serde_json::to_string(solution) {
            Ok(body) => body,
            // Turning these types into JSON cannot actually fail, so this
            // branch should never run. It is written out anyway because
            // crashing inside background work is a horrible way to find out
            // you were wrong about that.
            Err(error) => {
                eprintln!("could not serialise solution {}: {error}", solution.id);
                return;
            }
        };

        // The delivery outlives this function, so it cannot borrow anything that
        // lives here. These clones are cheap: the client is shared rather than
        // duplicated, and the rest is one short string.
        let delivery = Arc::clone(self);
        let order_id = solution.id.clone();

        tokio::spawn(async move {
            delivery.post(&url, body, &order_id).await;
        });
    }

    /// Sends one solution to the visualiser and prints how it went.
    ///
    /// Problems are printed rather than returned to the caller, because by this
    /// point there is no caller left to return them to. This is running in the
    /// background, long after the original request was answered, so the log is
    /// the only place anyone can learn what happened.
    async fn post(&self, url: &str, body: String, order_id: &str) {
        let result = self
            .client
            .post(url)
            .header("content-type", "application/json")
            .body(body)
            .send()
            .await;

        match result {
            // A success status means they accepted the solution. Any other
            // status means we reached them but they turned it away, and that is
            // worth telling apart from not reaching them at all. The first is
            // usually a disagreement about the data we sent; the second is
            // usually the network or a server that is not running.
            Ok(response) if response.status().is_success() => {
                println!("sent solution {order_id} to the visualizer ({})", response.status());
            }
            Ok(response) => {
                eprintln!(
                    "the visualizer rejected solution {order_id} with {}",
                    response.status()
                );
            }
            Err(error) => {
                eprintln!("could not reach the visualizer at {url} with solution {order_id}: {error}");
            }
        }
    }
}
