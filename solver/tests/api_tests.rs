use axum::{
    body::Body,
    http::{Request, StatusCode},
};

use solver::api::router::create_router;
use tower::ServiceExt;

#[tokio::test]
async fn valid_packing_request_returns_200()
{
    let app = create_router();

    let body = include_str!("../docs/example_data/combined.json");

    let request = Request::builder()
        .method("POST")
        .uri("/solve")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK)
}

#[tokio::test]
async fn partial_pack_returns_200_with_the_unpacked_items()
{
    let app = create_router();

    // One item is bigger than the only carton type, the other two fit. The
    // whole request used to be answered with a 400 and an error string, which
    // meant one bad line in an order threw away every carton already packed.
    let body = r#"
    {
        "Items": [
            {
                "ItemCode": "TOO-BIG",
                "ItemReference": "Oversized Item",
                "Width": 500,
                "Length": 500,
                "Depth": 500,
                "Weight": 1.0,
                "BoxGroup": null
            },
            {
                "ItemCode": "ITM-001",
                "ItemReference": "Widget",
                "Width": 50,
                "Length": 50,
                "Depth": 50,
                "Weight": 1.0,
                "BoxGroup": null
            },
            {
                "ItemCode": "ITM-002",
                "ItemReference": "Widget",
                "Width": 50,
                "Length": 50,
                "Depth": 50,
                "Weight": 1.0,
                "BoxGroup": null
            }
        ],
        "BoxTypes": [
            {
                "Reference": "SMALL-BOX",
                "Width": 100,
                "Length": 100,
                "Depth": 100,
                "MaxWeight": 10.0,
                "BoxWeight": 0.5,
                "Active": true,
                "MaximumBoxes": 10
            }
        ]
    }
    "#;

    let request = Request::builder()
        .method("POST")
        .uri("/solve")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("could not read the response body");
    let solution: serde_json::Value =
        serde_json::from_slice(&bytes).expect("the response was not JSON");

    let unpacked = solution["UnpackedItems"]
        .as_array()
        .expect("UnpackedItems is missing from the response");
    assert_eq!(unpacked.len(), 1, "only the oversized item should be left over");
    assert_eq!(unpacked[0]["ItemCode"], "TOO-BIG");

    let packed = solution["PackedBoxes"]
        .as_array()
        .expect("PackedBoxes is missing from the response");
    assert!(!packed.is_empty(), "the two widgets should still have been packed");
}

#[tokio::test]
async fn nothing_packable_at_all_returns_400(){
    let app = create_router();

    // The only packing failure left. Nothing was placed and there is no partial
    // solution to show anyone, so an error is the honest answer.
    let body = r#"
    {
        "Items": [
            {
                "ItemCode": "TOO-BIG",
                "ItemReference": "Oversized Item",
                "Width": 500,
                "Length": 500,
                "Depth": 500,
                "Weight": 1.0,
                "BoxGroup": null
            }
        ],
        "BoxTypes": [
            {
                "Reference": "SMALL-BOX",
                "Width": 100,
                "Length": 100,
                "Depth": 100,
                "MaxWeight": 10.0,
                "BoxWeight": 0.5,
                "Active": true,
                "MaximumBoxes": 10
            }
        ]
    }
    "#;

    let request = Request::builder()
        .method("POST")
        .uri("/solve")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();
    
        let response = app.oneshot(request).await.unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    
}

#[tokio::test]
async fn an_empty_order_returns_200_with_no_cartons()
{
    let app = create_router();

    // An order with nothing in it also packs no cartons, but it has nothing left
    // over either, so it is an empty solution rather than a failure. This is the
    // line the 400 above has to stay on the right side of.
    let body = r#"
    {
        "Items": [],
        "BoxTypes": [
            {
                "Reference": "SMALL-BOX",
                "Width": 100,
                "Length": 100,
                "Depth": 100,
                "MaxWeight": 10.0,
                "BoxWeight": 0.5,
                "Active": true,
                "MaximumBoxes": 10
            }
        ]
    }
    "#;

    let request = Request::builder()
        .method("POST")
        .uri("/solve")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("could not read the response body");
    let solution: serde_json::Value =
        serde_json::from_slice(&bytes).expect("the response was not JSON");

    assert_eq!(solution["PackedBoxes"].as_array().map(|b| b.len()), Some(0));
    assert_eq!(solution["UnpackedItems"].as_array().map(|i| i.len()), Some(0));
}

#[tokio::test]
async fn invalid_request_json_returns_422()
{
    let app = create_router();

    let body = r#"
    {
        "Items": "this should be an array",
        "BoxTypes": []
    }
    "#;

    let request = Request::builder()
        .method("POST")
        .uri("/solve")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);

}