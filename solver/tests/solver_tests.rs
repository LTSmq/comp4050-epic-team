use solver::api::schema::VisualizerSolution;
use solver::{BoxType, Item, PackedBox, Packer};

// What a pack produced, in the API's types, so these tests read the same
// cartons and leftovers /solve would send.
struct Outcome {
    packed_boxes: Vec<PackedBox>,
    unpacked_items: Vec<Item>,
}

fn pack(boxes: Vec<BoxType>, items: Vec<Item>) -> Outcome {
    let containers = boxes.into_iter().map(Into::into).collect();
    let items = items.into_iter().map(Into::into).collect();
    let solution = Packer::new(containers)
        .pack(items)
        .expect("the request should be valid");

    Outcome {
        packed_boxes: solution
            .containers
            .into_iter()
            .enumerate()
            .map(|(index, packed)| PackedBox::from_packed(index, packed))
            .collect(),
        unpacked_items: solution.unpacked.into_iter().map(|entry| entry.item.into()).collect(),
    }
}

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

    let result = pack(boxes, items);

    // Must be segregated into 2 distinct cartons
    assert!(result.unpacked_items.is_empty());
    assert_eq!(result.packed_boxes.len(), 2);
    assert_ne!(
        result.packed_boxes[0].assigned_box_group(),
        result.packed_boxes[1].assigned_box_group()
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

    let result = pack(boxes, items);

    // Too heavy for the only carton on offer, so no carton is opened and the
    // item comes back on the unpacked list instead of as a failure.
    assert!(result.packed_boxes.is_empty());
    assert_eq!(result.unpacked_items.len(), 1);
    assert_eq!(result.unpacked_items[0].item_code, "HEAVY");
}

#[test]
fn test_partial_pack_keeps_what_fitted() {
    // The case that used to cost a whole order. One item is larger than every
    // carton offered, and before this the solver answered with nothing at all,
    // throwing away cartons it had already filled. Now the oversized item is the
    // only thing that comes back unpacked.
    let items = vec![
        Item {
            item_code: "TOO-BIG".to_string(),
            item_reference: "Oversized Item".to_string(),
            width: 900,
            length: 900,
            depth: 900,
            weight: 1.0,
            box_group: None,
        },
        Item {
            item_code: "ITM-001".to_string(),
            item_reference: "Widget".to_string(),
            width: 100,
            length: 100,
            depth: 100,
            weight: 1.0,
            box_group: None,
        },
        Item {
            item_code: "ITM-002".to_string(),
            item_reference: "Widget".to_string(),
            width: 100,
            length: 100,
            depth: 100,
            weight: 1.0,
            box_group: None,
        },
    ];

    let result = pack(sample_boxes(), items);

    assert_eq!(result.unpacked_items.len(), 1, "only the oversized item should be left over");
    assert_eq!(result.unpacked_items[0].item_code, "TOO-BIG");

    let placed: usize = result.packed_boxes.iter().map(|b| b.placed_items.len()).sum();
    assert_eq!(placed, 2, "both widgets should still have been packed");
}

#[test]
fn test_solution_matches_the_visualizer_example_shape() {
    // The visualiser team reads this JSON directly, and the shape they asked for
    // is the one in data_format_example/solved_soltuion_example.json. This
    // compares every key at every level against that file, so a field renamed,
    // added or dropped on our side fails here rather than reaching them.
    let items = vec![
        Item {
            item_code: "ITM-001".to_string(),
            item_reference: "Widget".to_string(),
            width: 100,
            length: 100,
            depth: 100,
            weight: 1.0,
            box_group: None,
        },
        Item {
            item_code: "ITM-002".to_string(),
            item_reference: "Gadget".to_string(),
            width: 50,
            length: 80,
            depth: 120,
            weight: 1.0,
            box_group: None,
        },
    ];

    let outcome = pack(sample_boxes(), items);
    assert!(!outcome.packed_boxes.is_empty(), "the sample order should pack");

    let solution = VisualizerSolution::new("ORD-001".to_string(), &outcome.packed_boxes);
    let ours = serde_json::to_value(&solution).expect("the solution did not serialise");
    let theirs: serde_json::Value = serde_json::from_str(include_str!(
        "../data_format_example/solved_soltuion_example.json"
    ))
    .expect("the visualiser example is not JSON");

    assert_eq!(ours["id"], "ORD-001");
    assert_same_shape(&ours, &theirs, "solution");

    // The carton and the placements are copied across axis for axis: x is
    // Width, y is Length and z is Depth, the vertical one.
    let first_box = &outcome.packed_boxes[0];
    let package = &ours["packages"][0];
    assert_eq!(package["size"]["x"], first_box.box_type.width);
    assert_eq!(package["size"]["y"], first_box.box_type.length);
    assert_eq!(package["size"]["z"], first_box.box_type.depth);

    let placed = &first_box.placed_items[0];
    let item = &package["items"][0];
    assert_eq!(item["position"]["x"], placed.x);
    assert_eq!(item["position"]["y"], placed.y);
    assert_eq!(item["position"]["z"], placed.z);
    assert_eq!(item["size"]["x"], placed.width);
    assert_eq!(item["size"]["y"], placed.length);
    assert_eq!(item["size"]["z"], placed.depth);
}

// Walks both values together and fails on the first object whose keys differ.
// Arrays are compared by their first element, since every element of one of
// these arrays has the same shape.
fn assert_same_shape(ours: &serde_json::Value, theirs: &serde_json::Value, path: &str) {
    match (ours, theirs) {
        (serde_json::Value::Object(ours), serde_json::Value::Object(theirs)) => {
            let mut our_keys: Vec<&String> = ours.keys().collect();
            let mut their_keys: Vec<&String> = theirs.keys().collect();
            our_keys.sort();
            their_keys.sort();
            assert_eq!(our_keys, their_keys, "keys differ at {path}");

            for (key, value) in ours {
                assert_same_shape(value, &theirs[key], &format!("{path}.{key}"));
            }
        }
        (serde_json::Value::Array(ours), serde_json::Value::Array(theirs)) => {
            if let (Some(ours), Some(theirs)) = (ours.first(), theirs.first()) {
                assert_same_shape(ours, theirs, &format!("{path}[0]"));
            }
        }
        (ours, theirs) => {
            let kind = |value: &serde_json::Value| match value {
                serde_json::Value::Number(_) => "number",
                serde_json::Value::String(_) => "string",
                serde_json::Value::Bool(_) => "bool",
                serde_json::Value::Null => "null",
                serde_json::Value::Array(_) => "array",
                serde_json::Value::Object(_) => "object",
            };
            assert_eq!(kind(ours), kind(theirs), "value types differ at {path}");
        }
    }
}

#[test]
fn stacking_vertically_test() {
    let boxes = vec![BoxType {
        reference: "SML".to_string(),
        width: 150,
        length: 150,
        depth: 150,
        max_weight: Some(8.5),
        box_weight: Some(0.5),
        active: true,
        maximum_boxes: Some(10),
    }];

  let items: Vec<Item> = (1..=8)
        .map(|i| Item {
            item_code: format!("ITM-{:03}", i),
            item_reference: format!("Cube {}", i),
            width: 75,
            length: 75,
            depth: 75,
            weight: 0.5,
            box_group: None,
        })
        .collect();

    let result = pack(boxes, items).packed_boxes;

    assert_eq!(result.len(), 1, "all 8 cubes should fit in a single carton");
    assert_eq!(
        result[0].placed_items.len(), 8, "carton should hold all 8 items"
    );

    let mut z_values: Vec<u32> = result[0].placed_items
    .iter().map(|p| p.z).collect();
    z_values.sort_unstable();
    z_values.dedup();

    assert_eq!(
        z_values,
        vec![0, 75],
        "items should occupy two distinct Z layers (0 and 75), proving vertical stacking rather than a single flat layer"
    );

}
