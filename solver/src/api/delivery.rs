//! Sending a finished packing solution to the other two teams.
//!
//! Everywhere else, the solver waits to be asked: someone sends it a request and
//! it sends an answer straight back. This module is the one exception. Once a
//! solution is ready we also push a copy of it out to the visualiser, which
//! draws the cartons on screen, and another copy to the portal, which keeps the
//! record. That is what the Sprint 1 diagram in the README at the top of this
//! repository is describing.
//!
//! We are not told at compile time where those two teams are. Their addresses
//! come from environment variables, which are settings you put in front of the
//! command when you start the server:
//!
//!   VISUALIZER_URL   where to send the main copy
//!   PORTAL_URL       where to send the second copy
//!
//! Leaving one out is fine, and leaving both out is the normal way to work right
//! now, because neither team has given us an address yet. With neither set, the
//! solver sends nothing anywhere and behaves exactly as it did before this file
//! existed. That is on purpose: nobody should need the portal or the visualiser
//! running just to work on the packing code.
//!
//! One limitation worth knowing about: addresses starting with http work, and
//! addresses starting with https do not, because this build has no support for
//! encrypted connections. That was a deliberate trade. The library that adds it
//! has to be compiled from C source, so it needs cmake and a C compiler
//! installed, and every teammate would need those just to build the project.
//! While all three teams are on the same local network there is nothing to
//! encrypt, so it is not worth the cost yet. When one of them hands over an
//! https address, adding it back is a single line in Cargo.toml: give the
//! reqwest dependency the rustls feature. Until then, an https address is
//! called out when the server starts, so it is obvious rather than failing
//! silently on every solve.

use std::env;
use std::sync::Arc;
use std::time::Duration;

use super::schema::PackingResponse;

/// How long to wait for one of the other teams to answer before giving up on
/// them. Ten seconds is generous for a server on the same network, so anything
/// slower than this is almost certainly down rather than busy. Nothing is lost
/// by giving up either, because the person who asked for this packing already
/// has their answer.
const DELIVERY_TIMEOUT: Duration = Duration::from_secs(10);

/// One place we send solutions to. The name is only ever used in the messages
/// this file prints, so that a problem reads as "could not reach the portal"
/// rather than making you match a bare address to a team in your head.
#[derive(Debug, Clone)]
struct Destination {
    name: &'static str,
    url: String,
}

/// Everything needed to send solutions out: who to send them to, and the client
/// that does the sending.
///
/// A client here is the sending counterpart of a server. We build one and reuse
/// it for every delivery rather than making a fresh one each time, because it
/// keeps its network connections open between requests and reusing those is
/// faster than opening a new one for every solution.
#[derive(Debug)]
pub struct Delivery {
    client: reqwest::Client,
    destinations: Vec<Destination>,
}

impl Delivery {
    /// Works out where to send solutions by reading the two environment
    /// variables described at the top of this file. This is what the real server
    /// uses when it starts.
    ///
    /// A variable that was never set counts as "do not send there". So does one
    /// that is set to an empty value, which matters more than it sounds: people
    /// blank out a setting far more often than they delete it, and a blank
    /// address is not something we could send to anyway.
    pub fn from_env() -> Self {
        let mut destinations = Vec::new();

        for (name, variable) in [("visualizer", "VISUALIZER_URL"), ("portal", "PORTAL_URL")] {
            match env::var(variable) {
                Ok(url) if !url.trim().is_empty() => {
                    let url = url.trim().to_string();

                    // Flagged now, while somebody is watching the server start
                    // up, rather than leaving it to fail once per solve in a log
                    // nobody is reading.
                    if url.starts_with("https://") {
                        eprintln!(
                            "warning: {variable} is an https address and this build has no TLS, \
                             so every delivery to the {name} will fail. See the note at the top \
                             of src/api/delivery.rs."
                        );
                    }

                    println!("solutions will be sent to the {name} at {url}");
                    destinations.push((name, url));
                }
                _ => println!("no {variable} set, so nothing will be sent to the {name}"),
            }
        }

        Self::new(destinations)
    }

    /// Builds the same thing, but with the destinations handed in directly
    /// instead of read from the environment.
    ///
    /// The running server always uses from_env above. This version exists for
    /// the tests, which start a little server of their own and need to point the
    /// solver at it.
    pub fn new(destinations: Vec<(&'static str, String)>) -> Self {
        // The time limit is set here, on the client, so that every delivery it
        // ever makes carries it. Without one, a destination that accepts our
        // connection and then goes quiet would leave us waiting on it forever,
        // and the piece of work doing the waiting would never be cleaned up.
        let client = reqwest::Client::builder()
            .timeout(DELIVERY_TIMEOUT)
            .build()
            .expect("could not build the HTTP client for sending solutions");

        Self {
            client,
            destinations: destinations
                .into_iter()
                .map(|(name, url)| Destination { name, url })
                .collect(),
        }
    }

    /// True when there is nowhere to send solutions. That is the normal state
    /// while the other two teams have not given us addresses, so it is worth
    /// being able to ask rather than guess.
    pub fn is_idle(&self) -> bool {
        self.destinations.is_empty()
    }

    /// Starts sending this solution to everywhere it needs to go, and returns
    /// immediately without waiting for any of them to answer.
    ///
    /// Not waiting is the important part. Each delivery is handed to the runtime
    /// as a separate piece of work that carries on in the background, so the
    /// person who asked for this packing gets their answer at once instead of
    /// sitting behind a slow portal. Picture a warehouse worker holding their
    /// phone: their screen should not be waiting on somebody else's server.
    ///
    /// The trade is that we never find out here whether a delivery worked. A
    /// failure is printed and that copy is gone. Nothing is stored and nothing
    /// is tried again, because the solver keeps no record of past solutions to
    /// try again from. If a guaranteed handover is ever needed, that is a bigger
    /// change than this function.
    ///
    /// Note that the solution is turned into JSON text once, here, and the same
    /// text is handed to each destination. Doing it separately per destination
    /// would risk the two teams receiving slightly different bytes for what is
    /// meant to be the same solution.
    pub fn send(self: &Arc<Self>, solution: &PackingResponse) {
        if self.destinations.is_empty() {
            return;
        }

        let body = match serde_json::to_string(solution) {
            Ok(body) => body,
            // Turning these types into JSON cannot actually fail, so this
            // branch should never run. It is written out anyway because
            // crashing inside background work is a horrible way to find out
            // you were wrong about that.
            Err(error) => {
                eprintln!("could not serialise solution {}: {error}", solution.order_id);
                return;
            }
        };

        for destination in &self.destinations {
            // Each delivery outlives this function, so it cannot borrow anything
            // that lives here. Giving every one of them its own copy is what
            // these clones are for. They are cheap: the client is shared rather
            // than duplicated, and the rest is one short string each.
            let delivery = Arc::clone(self);
            let destination = destination.clone();
            let body = body.clone();
            let order_id = solution.order_id.clone();

            // This hands the delivery to the runtime and moves straight on to
            // the next one, so both go out side by side rather than one after
            // the other.
            tokio::spawn(async move {
                delivery.post(&destination, body, &order_id).await;
            });
        }
    }

    /// Sends one solution to one destination and prints how it went.
    ///
    /// Problems are printed rather than returned to the caller, because by this
    /// point there is no caller left to return them to. This is running in the
    /// background, long after the original request was answered, so the log is
    /// the only place anyone can learn what happened.
    async fn post(&self, destination: &Destination, body: String, order_id: &str) {
        let result = self
            .client
            .post(&destination.url)
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
                println!(
                    "sent solution {order_id} to the {} ({})",
                    destination.name,
                    response.status()
                );
            }
            Ok(response) => {
                eprintln!(
                    "the {} rejected solution {order_id} with {}",
                    destination.name,
                    response.status()
                );
            }
            Err(error) => {
                eprintln!(
                    "could not reach the {} at {} with solution {order_id}: {error}",
                    destination.name, destination.url
                );
            }
        }
    }
}
