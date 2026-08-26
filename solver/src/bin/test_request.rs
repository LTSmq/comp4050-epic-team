//! Runnable script: feeds a hand-written PackingRequest JSON payload through
//! the same schema + Solver pipeline that `api::handler::solve_handler` uses,
//! without needing an HTTP server. Run with `cargo run --bin test_request`.

use solver::api::schema::{PackingRequest, PackingResponse};
use solver::Solver;

const TEST_DATA: &str = r#"
{
  "Items": [
    {
      "ItemCode": "ITM-001",
      "ItemReference": "Widget A",
      "Width": 100,
      "Length": 200,
      "Depth": 50,
      "Weight": 1.0,
      "BoxGroup": "GROUP-A"
    },
    {
      "ItemCode": "ITM-002",
      "ItemReference": "Widget B",
      "Width": 300,
      "Length": 150,
      "Depth": 75,
      "Weight": 2.8,
      "BoxGroup": null
    },
    {
      "ItemCode": "ITM-003",
      "ItemReference": "Fragile Glassware",
      "Width": 80,
      "Length": 80,
      "Depth": 120,
      "Weight": 0.82,
      "BoxGroup": "GROUP-B"
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
    },
    {
      "Reference": "MED",
      "Width": 400,
      "Length": 400,
      "Depth": 400,
      "MaxWeight": 15.2,
      "BoxWeight": 0.75,
      "Active": true,
      "MaximumBoxes": null
    },
    {
      "Reference": "LRG",
      "Width": 1200,
      "Length": 1200,
      "Depth": 1200,
      "MaxWeight": null,
      "BoxWeight": null,
      "Active": false,
      "MaximumBoxes": null
    }
  ]
}
"#;

fn main() {
    println!("--- Request (test data) ---");
    println!("{}", TEST_DATA.trim());

    let request: PackingRequest =
        serde_json::from_str(TEST_DATA).expect("test data did not match PackingRequest schema");

    let solver = Solver::new(request.box_types);
    match solver.pack(request.items) {
        Ok(packed_boxes) => {
            let response = PackingResponse { packed_boxes };
            println!("\n--- Response (200) ---");
            println!("{}", serde_json::to_string_pretty(&response).unwrap());
        }
        Err(error) => {
            eprintln!("\n--- Response (400) ---");
            eprintln!("{}", serde_json::json!({ "Error": error }));
        }
    }
}
