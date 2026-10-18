//! Checks that a finished solution really does leave the solver and arrive at
//! the visualiser's address.
//!
//! The visualiser team has not told us where to send solutions yet, so there is
//! no real address to test against. Instead, each test below starts a small
//! throwaway server of its own and points the solver at that. It stands in for
//! the visualiser, which works because the solver does not care who is on the
//! other end: it only needs something listening at the address it was handed.

use std::sync::Arc;
use std::time::Duration;

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    routing::post,
    Router,
};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tower::ServiceExt;

use solver::api::delivery::Delivery;
use solver::api::router::create_router_with;

const SIMPLE_ORDER: &str = include_str!("../docs/example_data/combined.json");

/// Starts a stand-in for the visualiser.
///
/// It accepts whatever is posted to it, passes the body straight back to the
/// test through a channel, and replies with whichever status code the test asked
/// for, so a test can pretend to be a healthy receiver or a broken one. What you
/// get back is the address to send to, and the end of the channel where
/// deliveries turn up.
async fn start_receiver(reply_with: StatusCode) -> (String, UnboundedReceiver<String>) {
    let (sender, receiver) = unbounded_channel();

    async fn record(
        State((sender, reply_with)): State<(UnboundedSender<String>, StatusCode)>,
        body: String,
    ) -> StatusCode {
        // This only fails if the test has already finished and stopped
        // listening, which is not something this stand-in needs to care about.
        let _ = sender.send(body);
        reply_with
    }

    let app = Router::new()
        .route("/solutions", post(record))
        .with_state((sender, reply_with));

    // Asking for port 0 means "any free port you like", which the operating
    // system then picks for us. That way these tests never collide with each
    // other, or with a real solver already running on port 8080.
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("could not bind the test receiver");
    let address = listener.local_addr().expect("test receiver has no address");

    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("test receiver stopped");
    });

    (format!("http://{address}/solutions"), receiver)
}

/// Sends an order to /solve and hands back the status and body that came out.
/// The destinations passed in are where that solution should end up.
async fn solve(delivery: Arc<Delivery>, body: &str) -> (StatusCode, String) {
    let request = Request::builder()
        .method("POST")
        .uri("/solve")
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();

    let response = create_router_with(delivery)
        .oneshot(request)
        .await
        .expect("the router did not answer");

    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("could not read the response body");

    (status, String::from_utf8(bytes.to_vec()).expect("response was not text"))
}

/// Waits a little while for a delivery to show up, and gives up if none does.
///
/// The waiting is necessary because the solver does not hold up its reply while
/// it delivers. By the time we have the response in hand, the copies are still
/// on their way, so a test that checked immediately would usually find nothing.
async fn next_delivery(receiver: &mut UnboundedReceiver<String>) -> Option<String> {
    tokio::time::timeout(Duration::from_secs(5), receiver.recv())
        .await
        .unwrap_or(None)
}

#[tokio::test]
async fn solution_reaches_the_visualizer_exactly_as_returned() {
    let (url, mut visualizer) = start_receiver(StatusCode::OK).await;
    let delivery = Arc::new(Delivery::new(Some(url)));

    let (status, returned) = solve(delivery, SIMPLE_ORDER).await;
    assert_eq!(status, StatusCode::OK);

    let delivered = next_delivery(&mut visualizer)
        .await
        .expect("the visualizer was sent nothing");

    // The visualiser gets exactly what the caller of /solve got. That is
    // deliberate: it means there is only one solution shape in the whole system
    // for anyone to write code against.
    assert_eq!(delivered, returned);

    // And nothing else goes out. Under the Sprint 2 data flow the portal hears
    // about solutions from the visualiser, not from us.
    assert!(
        tokio::time::timeout(Duration::from_millis(300), visualizer.recv())
            .await
            .is_err(),
        "the solution should have been sent exactly once"
    );
}

#[tokio::test]
async fn delivered_solution_has_the_visualizer_shape() {
    let (url, mut receiver) = start_receiver(StatusCode::OK).await;
    let delivery = Arc::new(Delivery::new(Some(url)));

    let (status, _) = solve(delivery, SIMPLE_ORDER).await;
    assert_eq!(status, StatusCode::OK);

    let delivered: serde_json::Value = serde_json::from_str(
        &next_delivery(&mut receiver).await.expect("nothing was delivered"),
    )
    .expect("the delivery was not JSON");

    assert!(delivered["id"].is_string(), "{delivered}");
    let package = &delivered["packages"][0];
    for axis in ["x", "y", "z"] {
        assert!(package["size"][axis].is_number(), "{delivered}");
        assert!(package["items"][0]["position"][axis].is_number(), "{delivered}");
        assert!(package["items"][0]["size"][axis].is_number(), "{delivered}");
    }
}

#[tokio::test]
async fn order_id_from_the_request_is_carried_through() {
    let (url, mut receiver) = start_receiver(StatusCode::OK).await;
    let delivery = Arc::new(Delivery::new(Some(url)));

    // Sending our own identifier is the normal case and the reason the field
    // exists. Whoever receives this solution can look at the identifier and know
    // which order it belongs to.
    let mut order: serde_json::Value =
        serde_json::from_str(SIMPLE_ORDER).expect("the example order did not parse");
    order["OrderId"] = serde_json::Value::String("ORD-4050".to_string());

    let (status, returned) = solve(delivery, &order.to_string()).await;
    assert_eq!(status, StatusCode::OK);
    assert!(returned.contains("\"id\":\"ORD-4050\""), "{returned}");

    let delivered = next_delivery(&mut receiver)
        .await
        .expect("nothing was delivered");
    assert!(delivered.contains("\"id\":\"ORD-4050\""), "{delivered}");
}

#[tokio::test]
async fn a_portal_order_reaches_the_visualizer_under_its_own_id() {
    let (url, mut receiver) = start_receiver(StatusCode::OK).await;
    let delivery = Arc::new(Delivery::new(Some(url)));

    // The whole Sprint 2 path in one go: an order in the portal's shape comes in,
    // and the visualiser receives the solution under the portal's own id.
    let order = serde_json::json!({
        "id": "PORTAL-4050",
        "source": "Manual",
        "status": "Draft",
        "items": [
            {
                "ItemCode": "ITEM-001",
                "ItemReference": "REF-001",
                "Width": 300,
                "Length": 400,
                "Depth": 200,
                "Weight": 3.0,
                "BoxGroup": "A"
            }
        ],
        "boxTypes": [
            {
                "Reference": "MED",
                "Width": 600,
                "Length": 600,
                "Depth": 600,
                "MaxWeight": 20.0,
                "BoxWeight": 0.5,
                "Active": true,
                "MaximumBoxes": null
            }
        ]
    });

    let (status, returned) = solve(delivery, &order.to_string()).await;
    assert_eq!(status, StatusCode::OK, "{returned}");

    let delivered = next_delivery(&mut receiver)
        .await
        .expect("nothing was delivered");
    assert_eq!(delivered, returned);
    assert!(delivered.contains("\"id\":\"PORTAL-4050\""), "{delivered}");
}

#[tokio::test]
async fn a_request_without_an_order_id_still_gets_one() {
    let (url, mut receiver) = start_receiver(StatusCode::OK).await;
    let delivery = Arc::new(Delivery::new(Some(url)));

    // Our example order was written before this field existed, so it does not
    // have one. Rather than send out a solution nobody could identify, the
    // solver invents an identifier, and the same invented one has to appear both
    // in the reply and on the copy that goes out.
    let (status, returned) = solve(delivery, SIMPLE_ORDER).await;
    assert_eq!(status, StatusCode::OK);
    assert!(returned.contains("\"id\":\"solve-"), "{returned}");

    let delivered = next_delivery(&mut receiver)
        .await
        .expect("nothing was delivered");
    assert_eq!(delivered, returned);
}

#[tokio::test]
async fn a_destination_that_rejects_the_copy_does_not_affect_the_answer() {
    let (url, mut receiver) = start_receiver(StatusCode::INTERNAL_SERVER_ERROR).await;
    let delivery = Arc::new(Delivery::new(Some(url)));

    // Here the stand-in accepts the connection but answers with an error, as the
    // visualiser's server might if it disliked what we sent. The person who asked for
    // this packing still gets their answer, because their reply never depended
    // on the copy succeeding. The rejection is printed and that copy is gone,
    // which is the price of not waiting around.
    let (status, _) = solve(delivery, SIMPLE_ORDER).await;
    assert_eq!(status, StatusCode::OK);

    assert!(
        next_delivery(&mut receiver).await.is_some(),
        "the copy should still have been attempted"
    );
}

#[tokio::test]
async fn an_unreachable_destination_does_not_affect_the_answer() {
    // This time nobody is home at all. Claiming a port and then immediately
    // letting it go is a reliable way to get an address we know for certain has
    // nothing listening on it.
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let dead_address = listener.local_addr().unwrap();
    drop(listener);

    let delivery = Arc::new(Delivery::new(Some(format!("http://{dead_address}/solutions"))));

    let (status, _) = solve(delivery, SIMPLE_ORDER).await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn nothing_goes_out_when_no_destination_is_configured() {
    // No visualiser address is how everyone on the team is running the solver
    // right now, and how they will keep running it until that team hands one
    // over. So it has to behave exactly like the solver did before any of this
    // delivery code existed.
    let delivery = Arc::new(Delivery::new(None));
    assert!(delivery.is_idle());

    let (status, returned) = solve(delivery, SIMPLE_ORDER).await;
    assert_eq!(status, StatusCode::OK);
    assert!(returned.contains("\"packages\""), "{returned}");
}

#[tokio::test]
async fn a_partial_solution_is_still_delivered() {
    let (url, mut receiver) = start_receiver(StatusCode::OK).await;
    let delivery = Arc::new(Delivery::new(Some(url)));

    // An order carrying one item that fits no carton. What matters here is that
    // the other team hears about it at all: this used to be a 400, which meant
    // the visualiser was sent nothing and had nothing to draw, even though most
    // of the order had packed perfectly well.
    let mut order: serde_json::Value =
        serde_json::from_str(SIMPLE_ORDER).expect("the example order did not parse");
    order["Items"]
        .as_array_mut()
        .expect("the example order has no Items array")
        .push(serde_json::json!({
            "ItemCode": "TOO-BIG",
            "ItemReference": "Oversized Item",
            "Width": 5000,
            "Length": 5000,
            "Depth": 5000,
            "Weight": 1.0,
            "BoxGroup": null
        }));

    let (status, returned) = solve(delivery, &order.to_string()).await;
    assert_eq!(status, StatusCode::OK);

    let delivered = next_delivery(&mut receiver)
        .await
        .expect("a partial solution should still have been delivered");

    // The visualiser's shape carries no item codes and no leftovers list, so the
    // oversized item is simply not in it.
    assert_eq!(delivered, returned);
    assert!(delivered.contains("\"packages\""), "{delivered}");
    assert!(!delivered.contains("5000"), "{delivered}");
}

#[tokio::test]
async fn a_failed_pack_sends_nothing() {
    let (url, mut receiver) = start_receiver(StatusCode::OK).await;
    let delivery = Arc::new(Delivery::new(Some(url)));

    // Nothing here fits anywhere, so no carton is opened and there is no
    // solution to copy to anybody. This is the only packing failure left: an
    // order where some of it fits now comes back as a partial solution and does
    // get delivered, which the test above covers.
    let body = r#"
    {
        "Items": [
            {
                "ItemCode": "TOO-BIG",
                "ItemReference": "Oversized Item",
                "Width": 5000,
                "Length": 5000,
                "Depth": 5000,
                "Weight": 1.0,
                "BoxGroup": null
            }
        ],
        "BoxTypes": [
            {
                "Reference": "SML",
                "Width": 150,
                "Length": 150,
                "Depth": 150,
                "MaxWeight": 8.5,
                "BoxWeight": 0.5,
                "Active": true,
                "MaximumBoxes": 100
            }
        ]
    }"#;

    let (status, _) = solve(delivery, body).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    assert!(
        tokio::time::timeout(Duration::from_millis(500), receiver.recv())
            .await
            .is_err(),
        "a failed pack should not have sent anything"
    );
}
