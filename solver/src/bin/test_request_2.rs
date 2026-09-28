//! Runnable script: a second hand-written PackingRequest, distinct from
//! test_request.rs. That one showed a single flat layer (everything at the
//! same z); this one uses 8 identical cubes sized to stack two layers deep
//! in one SML carton, so x, y, *and* z all vary. Run with
//! `cargo run --bin test_request_2`.

use solver::api::schema::{PackingRequest, PackingResponse};
use solver::Solver;

const TEST_DATA: &str = r#"
{
  "Items": [
    { "ItemCode": "CUBE-1", "ItemReference": "Cube 1", "Width": 75, "Length": 75, "Depth": 75, "Weight": 0.3, "BoxGroup": null },
    { "ItemCode": "CUBE-2", "ItemReference": "Cube 2", "Width": 75, "Length": 75, "Depth": 75, "Weight": 0.3, "BoxGroup": null },
    { "ItemCode": "CUBE-3", "ItemReference": "Cube 3", "Width": 75, "Length": 75, "Depth": 75, "Weight": 0.3, "BoxGroup": null },
    { "ItemCode": "CUBE-4", "ItemReference": "Cube 4", "Width": 75, "Length": 75, "Depth": 75, "Weight": 0.3, "BoxGroup": null },
    { "ItemCode": "CUBE-5", "ItemReference": "Cube 5", "Width": 75, "Length": 75, "Depth": 75, "Weight": 0.3, "BoxGroup": null },
    { "ItemCode": "CUBE-6", "ItemReference": "Cube 6", "Width": 75, "Length": 75, "Depth": 75, "Weight": 0.3, "BoxGroup": null },
    { "ItemCode": "CUBE-7", "ItemReference": "Cube 7", "Width": 75, "Length": 75, "Depth": 75, "Weight": 0.3, "BoxGroup": null },
    { "ItemCode": "CUBE-8", "ItemReference": "Cube 8", "Width": 75, "Length": 75, "Depth": 75, "Weight": 0.3, "BoxGroup": null }
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
