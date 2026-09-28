use solver::{BoxType, Solver, Item};

fn sample_boxes() -> Vec<BoxType> {
    vec![
        BoxType {
            reference: "SML".to_string(),
            width: 150,
            length: 150,
            depth: 150,
            max_weight: Some(8.5),
            box_weight: Some(0.5),
            active: true,
            maximum_boxes: Some(10),
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
    ]
}

#[test]
fn test_box_group_segregation() {
    let boxes = sample_boxes();
    let items = vec![
        Item {
            item_code: "ITM-001".to_string(),
            item_reference: "Chemical A".to_string(),
            width: 100,
            length: 100,
            depth: 100,
            weight: 1.0,
            box_group: Some("HAZMAT".to_string()),
        },
        Item {
            item_code: "ITM-002".to_string(),
            item_reference: "Food Item".to_string(),
            width: 100,
            length: 100,
            depth: 100,
            weight: 1.0,
            box_group: Some("FOOD".to_string()),
        },
    ];

    let solver = Solver::new(boxes);
    let result = solver.pack(items).expect("Packing failed");

    // Must be segregated into 2 distinct cartons
    assert_eq!(result.len(), 2);
    assert_ne!(
        result[0].assigned_box_group(),
        result[1].assigned_box_group()
    );
}

#[test]
fn test_overweight_rejection() {
    let boxes = vec![BoxType {
        reference: "TINY".to_string(),
        width: 200,
        length: 200,
        depth: 200,
        max_weight: Some(2.0),
        box_weight: Some(0.1),
        active: true,
        maximum_boxes: None,
    }];

    let items = vec![Item {
        item_code: "HEAVY".to_string(),
        item_reference: "Lead Block".to_string(),
        width: 50,
        length: 50,
        depth: 50,
        weight: 5.0, // Exceeds 2.0 kg max
        box_group: None,
    }];

    let solver = Solver::new(boxes);
    let result = solver.pack(items);
    assert!(result.is_err());
}