//! A small runnable example, kept for trying the solver without starting the
//! server. It builds a fixed set of cartons and items in code, packs them, and
//! prints where each item ended up.
//!
//! Run it with: cargo run --bin demo
//!
//! This used to be the crate's main binary. It moved here when the HTTP server
//! took that place, so that cargo run on its own starts the server.

use solver::{BoxType, Solver, Item};

fn main() {
    let boxes = vec![
        BoxType {
            reference: "SML".to_string(),
            width: 150,
            length: 150,
            depth: 150,
            max_weight: Some(8.5),
            box_weight: Some(0.5),
            active: true,
            maximum_boxes: Some(100),
        },
        BoxType {
            reference: "MED".to_string(),
            width: 400,
            length: 400,
            depth: 400,
            max_weight: Some(15.2),
            box_weight: Some(0.75),
            active: true,
            maximum_boxes: None,
        },
        BoxType {
            reference: "LRG".to_string(),
            width: 1200,
            length: 1200,
            depth: 1200,
            max_weight: None,
            box_weight: None,
            active: false,
            maximum_boxes: None,
        },
    ];

    let items = vec![
        Item {
            item_code: "ITM-001".to_string(),
            item_reference: "Widget A".to_string(),
            width: 100,
            length: 200,
            depth: 50,
            weight: 1.0,
            box_group: Some("GROUP-A".to_string()),
        },
        Item {
            item_code: "ITM-002".to_string(),
            item_reference: "Widget B".to_string(),
            width: 300,
            length: 150,
            depth: 75,
            weight: 2.8,
            box_group: None,
        },
        Item {
            item_code: "ITM-003".to_string(),
            item_reference: "Fragile Glassware".to_string(),
            width: 80,
            length: 80,
            depth: 120,
            weight: 0.82,
            box_group: Some("GROUP-B".to_string()),
        },
    ];

    let solver = Solver::new(boxes);
    match solver.pack(items) {
        Ok(solution) => {
            for carton in &solution {
                println!(
                    "Carton #{} [{}] (Group: {:?}):",
                    carton.box_index + 1,
                    carton.box_type.reference,
                    carton.assigned_box_group()
                );
                println!(
                    "  Gross Weight: {:.2} kg / Max: {:?}",
                    carton.gross_weight(),
                    carton.box_type.max_weight
                );
                for p in &carton.placed_items {
                    println!(
                        "    - {} @ ({}, {}, {}) size=({}x{}x{})",
                        p.item.item_code, p.x, p.y, p.z, p.width, p.length, p.depth
                    );
                }
            }
        }
        Err(err) => eprintln!("Packing Error: {}", err),
    }
}