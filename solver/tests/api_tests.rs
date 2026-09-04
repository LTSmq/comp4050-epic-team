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
async fn unpackable_item_returns_400(){
    let app = create_router();

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