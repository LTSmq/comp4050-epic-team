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
        unpacked_items: solution
            .unpacked
            .into_iter()
            .map(|entry| entry.item.into())
            .collect(),
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
        quantity: 1,
    }];

    let result = pack(boxes, items);

    // Too heavy for the only carton on offer, so no carton is opened and the
    // item comes back on the unpacked list instead of as a failure.
    assert!(result.packed_boxes.is_empty());
    assert_eq!(result.unpacked_items.len(), 1);
    assert_eq!(result.unpacked_items[0].item_code, "HEAVY");
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
            quantity: 1,
        },
        Item {
            item_code: "ITM-002".to_string(),
            item_reference: "Gadget".to_string(),
            width: 50,
            length: 80,
            depth: 120,
            weight: 1.0,
            box_group: None,
            quantity: 1,
        },
    ];

    let outcome = pack(sample_boxes(), items);
    assert!(
        !outcome.packed_boxes.is_empty(),
        "the sample order should pack"
    );

    let solution = VisualizerSolution::new("ORD-001".to_string(), &outcome.packed_boxes, &[]);
    let mut ours = serde_json::to_value(&solution).expect("the solution did not serialise");
    let theirs: serde_json::Value = serde_json::from_str(include_str!(
        "../data_format_example/solved_soltuion_example.json"
    ))
    .expect("the visualiser example is not JSON");

    assert_eq!(ours["id"], "ORD-001");

    // The visualiser's example predates the unpacked list, so that one key is
    // checked here and set aside before the rest is compared against it. Any
    // other difference still fails.
    let unpacked = ours
        .as_object_mut()
        .unwrap()
        .remove("unpacked")
        .expect("unpacked should always be present");
    assert_eq!(
        unpacked,
        serde_json::json!([]),
        "a complete pack leaves nothing over"
    );

    // Each item also carries its identity, which the example predates as well.
    // Those keys are checked and set aside in the same way.
    let mut identities = Vec::new();
    for package in ours["packages"].as_array_mut().unwrap() {
        for item in package["items"].as_array_mut().unwrap() {
            let item = item.as_object_mut().unwrap();
            let code = item.remove("itemCode").expect("itemCode should be present");
            let reference = item
                .remove("itemReference")
                .expect("itemReference should be present");
            let unit = item.remove("unit").expect("unit should be present");
            identities.push((code, reference, unit));
        }
    }
    identities.sort_by_key(|(code, _, _)| code.to_string());
    assert_eq!(
        identities,
        [
            ("ITM-001".into(), "Widget".into(), 1.into()),
            ("ITM-002".into(), "Gadget".into(), 1.into()),
        ]
    );

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

#[test]
fn test_unpacked_items_carry_a_reason_code_on_the_solution() {
    // One carton that is small and weak: one item is too big for it, another
    // fits but is too heavy, and a third packs. The two leftovers should come
    // back with different codes, not the same generic failure.
    let boxes = vec![BoxType {
        reference: "WEAK".to_string(),
        width: 200,
        length: 200,
        depth: 200,
        max_weight: Some(2.0),
        box_weight: Some(0.1),
        active: true,
        maximum_boxes: None,
    }];
    let item = |code: &str, side: u32, weight: f32| Item {
        item_code: code.to_string(),
        item_reference: format!("{code} reference"),
        width: side,
        length: side,
        depth: side,
        weight,
        box_group: None,
        quantity: 1,
    };
    let items = vec![
        item("FITS", 50, 1.0),
        item("HUGE", 500, 1.0),
        item("LEAD", 50, 5.0),
    ];

    let containers = boxes.into_iter().map(Into::into).collect();
    let solution = Packer::new(containers)
        .pack(items.into_iter().map(Into::into).collect())
        .expect("the request should be valid");
    let packed_boxes: Vec<PackedBox> = solution
        .containers
        .into_iter()
        .enumerate()
        .map(|(index, packed)| PackedBox::from_packed(index, packed))
        .collect();

    let wire = serde_json::to_value(VisualizerSolution::new(
        "ORD-002".to_string(),
        &packed_boxes,
        &solution.unpacked,
    ))
    .expect("the solution did not serialise");

    let unpacked = wire["unpacked"].as_array().expect("unpacked is missing");
    let reason_for = |code: &str| {
        unpacked
            .iter()
            .find(|entry| entry["itemCode"] == code)
            .unwrap_or_else(|| panic!("{code} should be unpacked: {wire}"))["reason"]
            .clone()
    };
    assert_eq!(unpacked.len(), 2, "{wire}");
    assert_eq!(reason_for("HUGE"), "TooLarge");
    assert_eq!(reason_for("LEAD"), "TooHeavy");

    // The entry names the order line and gives its size as ordered.
    let huge = unpacked
        .iter()
        .find(|entry| entry["itemCode"] == "HUGE")
        .unwrap();
    let mut keys: Vec<&String> = huge.as_object().unwrap().keys().collect();
    keys.sort();
    assert_eq!(
        keys,
        [
            "itemCode",
            "itemReference",
            "reason",
            "size",
            "unit",
            "weight"
        ]
    );
    assert_eq!(huge["itemReference"], "HUGE reference");
    assert_eq!(
        huge["size"],
        serde_json::json!({ "x": 500, "y": 500, "z": 500 })
    );
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
fn every_unit_of_an_item_code_gets_its_own_number() {
    // Three units of one line pack and a fourth does not fit, so the numbering
    // has to run on from the packages into unpacked without repeating.
    let boxes = vec![BoxType {
        reference: "ONE".to_string(),
        width: 100,
        length: 100,
        depth: 100,
        max_weight: None,
        box_weight: None,
        active: true,
        maximum_boxes: Some(3),
    }];
    let cube = Item {
        item_code: "CUBE".to_string(),
        item_reference: "Cube".to_string(),
        width: 100,
        length: 100,
        depth: 100,
        weight: 1.0,
        box_group: None,
        quantity: 1,
    };

    let containers = boxes.into_iter().map(Into::into).collect();
    let solution = Packer::new(containers)
        .pack(vec![cube.into(); 4])
        .expect("the request should be valid");
    let packed_boxes: Vec<PackedBox> = solution
        .containers
        .into_iter()
        .enumerate()
        .map(|(index, packed)| PackedBox::from_packed(index, packed))
        .collect();
    let wire = serde_json::to_value(VisualizerSolution::new(
        "ORD-003".to_string(),
        &packed_boxes,
        &solution.unpacked,
    ))
    .expect("the solution did not serialise");

    let mut units: Vec<u64> = wire["packages"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|package| package["items"].as_array().unwrap())
        .map(|item| item["unit"].as_u64().unwrap())
        .collect();
    assert_eq!(units, [1, 2, 3], "{wire}");

    units.extend(
        wire["unpacked"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| entry["unit"].as_u64().unwrap()),
    );
    assert_eq!(units, [1, 2, 3, 4], "{wire}");
}
