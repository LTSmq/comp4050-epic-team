//! Small demonstration of the current Perfect Fit packing engine.
//!
//! Run with:
//! cargo run --bin demo
//!
//! The legacy Solver demonstration is kept separately in legacy_demo.rs.

use solver::Packer;
use solver::types::{Container, Item, Orientation};

fn main() {
    let containers = vec![
        Container {
            reference: "SML".to_string(),
            width: 150,
            length: 150,
            depth: 150,
            max_weight: Some(8.5),
            tare_weight: Some(0.5),
            active: true,
            max_containers: Some(100),
        },
        Container {
            reference: "MED".to_string(),
            width: 400,
            length: 400,
            depth: 400,
            max_weight: Some(25.0),
            tare_weight: Some(0.75),
            active: true,
            max_containers: None,
        },
    ];

    let items: Vec<Item> = (1..=8)
        .map(|i| Item {
            item_code: format!("CUBE-{i}"),
            item_reference: format!("Demo Cube {i}"),
            width: 75,
            length: 75,
            depth: 75,
            weight: 0.3,
            compatibility_group: None,
            fragile: false,
            max_load_kg: None,
            orientation: Orientation::Any,
        })
        .collect();

    let packer = Packer::new(containers);

    match packer.pack(items) {
        Ok(solution) => {
            println!("Packing complete: {}", solution.is_complete());
            println!("Cartons used: {}", solution.container_count());
            println!("Utilisation: {:.2}%", solution.utilisation() * 100.0);

            for (index, carton) in solution.containers.iter().enumerate() {
                println!("\nCarton #{} [{}]", index + 1, carton.container.reference);

                for placement in &carton.placements {
                    println!(
                        "  {} @ ({}, {}, {}) size=({}x{}x{})",
                        placement.item.item_code,
                        placement.x,
                        placement.y,
                        placement.z,
                        placement.width,
                        placement.length,
                        placement.depth
                    );
                }
            }

            if !solution.unpacked.is_empty() {
                println!("\nUnpacked items:");

                for item in &solution.unpacked {
                    println!("  {}: {}", item.item.item_code, item.reason);
                }
            }
        }

        Err(error) => {
            eprintln!("Packing failed: {error}");
        }
    }
}
