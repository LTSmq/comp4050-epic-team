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

  Since superseded: the response is now the visualiser's shape, and the list is the
  lowercase unpacked key described in docs/output_schema.md.

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

  Since superseded: the response moved to the visualiser's lowercase shape, so PascalCase
  now applies only inside an order. test_solution_matches_the_visualizer_example_shape
  guards the response instead; see docs/output_schema.md.

## Priority 3: cleanup and handover

- [x] **Say why an item could not be packed, not just that it could not**

  The Visualizer solution shape had no place for leftovers, so a partial solution looked
  exactly like a complete one and only the server log said otherwise. The solution now
  carries an unpacked list, always present and empty when everything was placed. Each
  entry has itemCode, itemReference, size (as ordered, not rotated), weight and a reason.

  The reason is a fixed code to branch on, not a sentence: TooLarge, TooHeavy,
  SupplyExhausted or CartonLimitReached (UnpackedReason in src/packer.rs). When more than
  one applies, the nearest miss wins, so an item that fits a carton but outweighs it is
  TooHeavy even if it is too large for every other carton.

  On the Chaotic example this showed the earlier note here was wrong. The 3 GLASS and 2
  LEAD are not wider than every carton: GLASS fits Large Cube and LEAD fits Picture Box,
  and both are TooHeavy only because box weight counts against MaxWeight. Which reading of
  MaxWeight is right is still open (see the reference datasets note in CLAUDE.md).

  unpacked is one key added to the Visualizer team's shape, which
  data_format_example/solved_soltuion_example.json does not have yet. They need to agree
  to it and add it to their example; until then
  test_solution_matches_the_visualizer_example_shape exempts that one key.

  Covered by the reason tests in src/packer.rs,
  test_unpacked_items_carry_a_reason_code_on_the_solution in tests/solver_tests.rs, and the
  partial order tests in tests/api_tests.rs and tests/delivery_tests.rs.

- [x] **Write down the output format for the display team**

  docs/output_schema.md describes the solution the visualiser receives: every field, the
  units (whole millimetres and kilograms), positions from the carton's bottom corner, sizes
  after rotation, z as the vertical axis, the unpacked list and its four reason codes, and
  every error status with its body. It includes a complete example response produced by
  the running server rather than written by hand.

  It says plainly that a 200 does not mean every item was placed. The visualiser team has
  agreed to the unpacked key; their example file still needs it added, after which
  test_solution_matches_the_visualizer_example_shape can stop exempting it.

  Writing it turned up one undocumented status: a request without a JSON Content-Type
  header gets a 415 from axum. That, the non-JSON 400 and the over-size 413 all have plain
  text bodies rather than the Error object, and both documents now say so.

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
