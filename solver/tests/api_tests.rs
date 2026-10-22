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
async fn partial_pack_returns_200_with_what_fitted()
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

    // The two widgets are packed and the oversized item is named on the
    // unpacked list with a code saying why, so the reply cannot be mistaken
    // for a complete solution.
    let unpacked = solution["unpacked"].as_array().expect("unpacked is missing");
    assert_eq!(unpacked.len(), 1, "{solution}");
    assert_eq!(unpacked[0]["itemCode"], "TOO-BIG");
    assert_eq!(unpacked[0]["reason"], "TooLarge");

    let placed: usize = solution["packages"]
        .as_array()
        .expect("packages is missing from the response")
        .iter()
        .map(|package| package["items"].as_array().map_or(0, |items| items.len()))
        .sum();
    assert_eq!(placed, 2, "the two widgets should still have been packed");
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

    assert_eq!(solution["packages"].as_array().map(|b| b.len()), Some(0));
    assert_eq!(solution["unpacked"].as_array().map(|u| u.len()), Some(0));
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

// The order exactly as the portal team supplied it, in their shape.
const PORTAL_ORDER: &str = include_str!("../data_format_example/input_from_portal.json");

// The portal's example with the two things it is missing filled in: a weight on
// each item and the list of cartons it may be packed into, under boxTypes.
fn complete_portal_order() -> serde_json::Value {
    let mut order: serde_json::Value =
        serde_json::from_str(PORTAL_ORDER).expect("the portal example is not JSON");

    order["id"] = serde_json::json!("PORTAL-001");
    for item in order["items"].as_array_mut().expect("the portal example has no items") {
        item["Weight"] = serde_json::json!(2.0);
    }
    order["boxTypes"] = serde_json::json!([
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
    ]);

    order
}

async fn post_solve(body: String) -> (StatusCode, serde_json::Value) {
    let request = Request::builder()
        .method("POST")
        .uri("/solve")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();

    let response = create_router().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("could not read the response body");

    (status, serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null))
}

#[tokio::test]
async fn a_complete_portal_order_returns_the_visualizer_shape()
{
    let (status, solution) = post_solve(complete_portal_order().to_string()).await;
    assert_eq!(status, StatusCode::OK, "{solution}");

    assert_eq!(solution["id"], "PORTAL-001");

    let packages = solution["packages"].as_array().expect("packages is missing");
    assert!(!packages.is_empty());
    for package in packages {
        for axis in ["x", "y", "z"] {
            assert_eq!(package["size"][axis], 600, "the carton is reported in millimetres");
        }
    }

    let placed: usize = packages
        .iter()
        .map(|package| package["items"].as_array().unwrap().len())
        .sum();
    assert_eq!(placed, 2, "both of the portal's items should be packed");
}

#[tokio::test]
async fn the_portal_example_as_supplied_is_rejected_with_422()
{
    // As it stands the portal's example has no weights and no cartons, so there
    // is nothing the solver can safely pack it into. This test is here to fail,
    // and be updated, on the day the portal's example gains both.
    let (status, error) = post_solve(PORTAL_ORDER.to_string()).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(error["Error"].is_string(), "{error}");
}

#[tokio::test]
async fn a_portal_item_without_a_weight_is_rejected_with_422()
{
    let mut order = complete_portal_order();
    order["items"][0]
        .as_object_mut()
        .unwrap()
        .remove("Weight");

    let (status, error) = post_solve(order.to_string()).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(
        error["Error"].as_str().is_some_and(|message| message.contains("Weight")),
        "{error}"
    );
}

#[tokio::test]
async fn a_portal_order_without_box_types_is_rejected_with_422()
{
    let mut order = complete_portal_order();
    order.as_object_mut().unwrap().remove("boxTypes");

    let (status, error) = post_solve(order.to_string()).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(
        error["Error"].as_str().is_some_and(|message| message.contains("boxTypes")),
        "{error}"
    );
}
