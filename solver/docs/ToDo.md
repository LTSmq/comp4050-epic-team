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

## Beyond the MVP

- [x] **Read Quantity on an order line**

  The SemiRealistic and Chaotic item files give each line a Quantity, but the wire item
  had no such field and serde dropped it. Posting Chaotic packed 30 units instead of 300
  and still answered 200, which is the worst kind of wrong answer.

  Item now has an optional Quantity, defaulting to 1, and the handler expands each line
  into that many units before packing. The 10,000 item limit counts units and is checked
  before anything is expanded, so one line asking for billions is a quick 413. A Quantity
  of 0 is a 422, since it almost always means the count was lost somewhere.

  packer_schemas.yaml under docs/example_data still has no Quantity. That directory is
  read only, so whoever owns it needs to add the field. The Portal team should also be
  told it exists.

  Covered by quantity_expands_a_line_into_that_many_units,
  the_chaotic_scenario_packs_every_unit_it_lists, a_quantity_of_zero_is_rejected_with_422
  and one_line_with_a_huge_quantity_is_rejected_with_413 in tests/api_tests.rs.

- [x] **Say which item each placement is**

  Every unit of a line used to come out as a bare position and size, so a viewer could
  not label one or map a click back to the order. Each placed item now carries itemCode,
  itemReference and a unit number, counted from 1 per item code across the packages and
  on into unpacked, which carries the same three keys. The code and unit together name
  one physical item.

  The numbers are given out as the solution is written rather than carried through the
  packer, because units of one code are interchangeable and the packer has no need to
  know them apart. The cost is that two order lines sharing an item code share one count.

  These keys are additions to the visualiser's example, like unpacked, and need their
  sign-off. test_solution_matches_the_visualizer_example_shape checks them and sets them
  aside until the example has them. viewer/solution.js still matches items by size and
  could read the codes directly now.

  Covered by every_unit_of_an_item_code_gets_its_own_number in tests/solver_tests.rs and
  the shape test.

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
