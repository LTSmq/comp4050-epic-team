use solver::api::schema::PackingResponse;
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

#[test]
fn test_response_json_is_all_pascal_case() {
    // The display team reads this JSON directly, so every key on the way out
    // has to be PascalCase. PackedBox and PlacedItem used to serialise in
    // snake_case, which meant a reader switched between the two styles twice
    // per carton. This locks the wire format so that cannot come back.
    let items = vec![Item {
        item_code: "ITM-001".to_string(),
        item_reference: "Widget".to_string(),
        width: 100,
        length: 100,
        depth: 100,
        weight: 1.0,
        box_group: None,
    }];

    let solver = Solver::new(sample_boxes());
    let packed_boxes = solver.pack(items).expect("Packing failed");
    let response = PackingResponse { packed_boxes };
    let json = serde_json::to_string(&response).expect("Response did not serialise");

    for expected in [
        "\"PackedBoxes\"",
        "\"BoxIndex\"",
        "\"BoxType\"",
        "\"PlacedItems\"",
        "\"Item\"",
        "\"X\"",
        "\"Y\"",
        "\"Z\"",
    ] {
        assert!(json.contains(expected), "missing key {expected} in {json}");
    }

    // Catches any key starting with a lowercase letter, so a field added later
    // without the rename fails here rather than reaching the display team.
    // Odd-numbered pieces are the quoted strings; a piece is a key rather than
    // a value when a colon follows its closing quote.
    let pieces: Vec<&str> = json.split('"').collect();
    for (index, piece) in pieces.iter().enumerate() {
        let is_key = index % 2 == 1
            && pieces
                .get(index + 1)
                .is_some_and(|next| next.starts_with(':'));
        if is_key {
            assert!(
                !piece.starts_with(|c: char| c.is_ascii_lowercase()),
                "key {piece} is not PascalCase in {json}"
            );
        }
    }
}
