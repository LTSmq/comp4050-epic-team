# Solver MVP ToDo

MVP Checklist items that need addressing

## Priority 1: blocking

Nothing works from end to end until these are done.

- [x] **Return the cartons that did pack instead of failing the whole order**

  One item that fit no carton made /solve answer 400 and throw away every carton already
  filled. On the Chaotic example that was 5 units out of 300 costing the other 295, along
  with the 135 cartons holding them, and nothing went to the visualiser or the portal either.
  Any demo order with one oversized line died the same way.

  The packer returns both the packed cartons and a list of unpacked items, and the response
  carries that list as UnpackedItems, a new PascalCase key that is always present and almost
  always empty.

  400 still exists but now means only that nothing could be packed at all, because then there
  is no solution to show anyone and nothing to deliver. An empty order is not that case: no
  items in, nothing left over, empty solution back with a 200.

  UnpackedItems is an added key rather than a changed one, so nothing the visualiser or portal
  already reads moves, but both teams should be told it is there and that a 200 no longer
  guarantees every item was placed.

  Covered by oversized_items_are_reported_not_fatal in src/packer.rs, three tests in
  tests/api_tests.rs for the 200 with leftovers, the empty order and the remaining 400, and
  a_partial_solution_is_still_delivered in tests/delivery_tests.rs.

- [x] **Add a test that sends a real HTTP request**

  No test used to touch create_router() at all, so a broken route or a changed response shape
  would not have failed the suite. tests/api_tests.rs now drives the router through tower's
  oneshot, which is why tower with its "util" feature is a dev dependency. It covers the valid
  request, the malformed body that returns 422, an order where nothing can be packed at all,
  an order where only part of it can, and an empty order.

## Priority 2: correctness

These should be fixed before another team starts relying on the output.

- [x] **Make the JSON field names consistent**

  PackingRequest, PackingResponse, Item and BoxType all use PascalCase field names.
  PackedBox (src/models.rs, line 81) and PlacedItem (src/models.rs, line 58) did not, so
  their fields came out in snake_case instead. Anyone reading a response had to switch
  between the two styles twice per carton:

  {"PackedBoxes":[{"box_index":0,"box_type":{"Reference":"MED"},"placed_items":[]}]}

  Fixed by adding #[serde(rename_all = "PascalCase")] to both structs. Responses are now
  uniformly PascalCase: box_index became BoxIndex, box_type became BoxType, placed_items
  became PlacedItems, and on a placed item the item, x, y and z fields became Item, X, Y
  and Z. Nothing consumed the old shape yet, so no client needed migrating.

  test_response_json_is_all_pascal_case in tests/solver_tests.rs locks this in. It checks
  the expected keys are present and then fails on any key starting with a lowercase
  letter, so a field added later without the rename is caught here rather than by the
  display team.

## Priority 3: cleanup and handover

- [ ] **Say why an item could not be packed, not just that it could not**

  UnpackedItems on the response lists what fit nowhere, but every entry looks the same
  whatever went wrong. Too large for every carton, heavier than every carton allows, and
  "the last carton of the only type that would have held it was already used" are three
  different problems needing three different answers, and right now they are told apart by
  eye.

  On the Chaotic example the list comes back as 3 GLASS and 2 LEAD, and working out that
  both are flat sheets wider than any carton means reading the carton table yourself.

  The packer already works out a reason for every item it leaves over (the reason field on
  UnpackedItem in src/packer.rs), and the handler drops it when building the response. So
  most of the work left is agreeing the wire shape, not computing the reason.

  The shape to add is a reason on each entry rather than a bare Item, for example
  {"Item": {...}, "Reason": "TooLarge"}. That is a wire change on a key the display team
  will have started reading by then, so agree it with them and the portal first rather than
  changing it underneath them. Whoever picks this up should also decide whether the reason
  is a fixed set of codes they can branch on or a sentence for a human to read, because a
  sentence is easier to write and useless to code.

  Worth doing before anyone builds a screen that shows leftovers to a warehouse worker, and
  not worth doing before then.

  Done when: each unpacked entry carries a reason, and a test covers the too-large and
  too-heavy cases producing different ones.

- [ ] **Write down the output format for the display team**

  They need a stable description of the JSON rather than example code. Write a short
  docs/output_schema.md covering what each field means, the fact that all measurements are
  in millimetres, the fact that positions are measured from the bottom corner of the
  carton, and the fact that the Width, Length and Depth on a placed item are the values
  after rotation, so the display team does not have to work the rotation out themselves.
  Include one complete example response.

  It also needs to cover UnpackedItems, and to say plainly that a 200 no longer means every
  item was placed, because a reader who assumes it does will draw a partial solution as if
  it were a complete one.

  Also confirm with them which axis counts as "up". The packer treats z as the vertical
  axis.

## Not part of the MVP

- Fetching orders from anywhere. There is no order ID, customer, database or queue in the
  project. The /solve endpoint expects the caller to supply the items and carton types
  directly. That is fine for the MVP, but worth stating so nobody assumes it already exists.
- A live 3D viewer. docs/misc once held hand drawn HTML pictures of two packing results, but
  they had to be redrawn by hand whenever the test data changed, so they were deleted. For
  the MVP the handover is the JSON, and rendering is the display team's side of the work.
- Fragile, maximum load and this-way-up on the request. constraints.rs already enforces
  them, but the request schema has no fields for them yet, so every item arrives with them
  switched off.
