# Solver MVP ToDo

MVP Checklist items that need addressing

## Priority 1: blocking

Nothing works from end to end until these are done.

- [ ] **Fix how the solver chooses a carton (src/solver.rs, line 33)**

  The loop over carton types stops as soon as a carton holds even one item. This means the
  solver picks the smallest carton that fits any single item, rather than the carton that
  fits the most items.

  For example, an order of one large 380x380x180 crate plus four 100mm cubes comes back as
  5 cartons. Four of those are small cartons holding a single cube each, roughly 29 percent
  full. Give the same solver only the medium carton and it fits all five items into 1 carton.

  Across the 3,000 random orders, the solver averaged only 3.31 items per carton.

  To fix it, choose the carton based on the largest item still waiting to be packed, or try
  every carton type and keep whichever one packs the most.

  Done when: the example above produces 1 carton instead of 5.

- [ ] **Add a test that sends a real HTTP request**

  No test currently touches create_router() at all. Add tests for three cases: a valid
  request returns 200 with the expected placements, a malformed request body returns 422,
  and an item that cannot be packed returns 400 with the error message.

  This needs the tower crate (with its "util" feature) added as a dev dependency, or you
  can start the server on a random free port inside the test itself.

## Priority 2: correctness

These should be fixed before another team starts relying on the output.

- [ ] **Decide whether MaxWeight includes the weight of the carton itself**

  Two parts of the code disagree about this. The weight check in src/solver.rs at line 107
  adds up the items only. The gross_weight() function in src/models.rs at line 100 also
  adds BoxWeight, which is the weight of the empty carton.

  Because of this, an 8.4 kg item is accepted into a small carton with a MaxWeight of 8.5
  and a BoxWeight of 0.5. That carton then ships at 8.9 kg, which is over the stated limit.

  Pick one meaning, apply it in both places, and write down which one was chosen in the
  README.

  Done when: a test covers the boundary case and the README states which meaning is used.

- [ ] **Decide what should happen to items that have no compatibility group**

  The check in src/solver.rs at line 114 only applies when the carton and the item both
  have a group set. An item with no group never blocks anything. So if an untagged item
  goes into a carton first, a HAZMAT item is then allowed to join it. This was confirmed by
  running it.

  The README describes this as intended ("items with no group are unrestricted"), but the
  effect is that untagged stock can be packed together with dangerous goods, and untagged
  is the normal case rather than the exception.

  There are two reasonable options. Either treat "no group" as a group of its own, so
  untagged items only pack with other untagged items, or add a flag to each group saying
  whether it is allowed to mix with untagged items.

  Done when: a test confirms an untagged item and a HAZMAT item end up in separate cartons,
  or the README explains why mixing them is acceptable.

- [ ] **Stop items being placed floating in mid air**

  When placing an item, the solver only checks that it does not overlap another item. It
  never checks that anything is underneath it. In the 3,000 random orders, 47 items out of
  about 19,500 were placed above the carton floor with nothing holding them up.

  A layout like that cannot be packed by hand, and it looks broken in a 3D view.

  The simplest fix is to require, before accepting a position, that part of the item's base
  rests on either the carton floor or the top face of another item.

  Done when: rerunning the random order check reports zero unsupported items.

- [ ] **Make the JSON field names consistent**

  PackingRequest, PackingResponse, Item and BoxType all use PascalCase field names.
  PackedBox (src/models.rs, line 81) and PlacedItem (src/models.rs, line 58) do not, so
  their fields come out in snake_case instead. Anyone reading a response has to switch
  between the two styles twice per carton:

  {"PackedBoxes":[{"box_index":0,"box_type":{"Reference":"MED"},"placed_items":[]}]}

  Adding #[serde(rename_all = "PascalCase")] to both structs fixes it. This changes the
  JSON that clients receive, so check with whoever reads it before making the change.

## Priority 3: cleanup and handover

- [ ] **Fix volume_cm3 rounding small items down to zero**

  The volume_cm3() function in src/models.rs at line 17 divides cubic millimetres by 1,000
  using integer division, so anything smaller than one cubic centimetre becomes 0. A
  10x10x5mm item therefore scores the same as an item with no size at all, which means
  sorting items by size stops working for small parts.

  Sort using the raw cubic millimetre value instead, and keep volume_cm3 for display only.

- [ ] **Add a test that locks in the carton count**

  Once the carton selection is fixed, add a test asserting that the order of one large
  crate plus four cubes packs into a single medium carton. This stops a later change from
  quietly making the packing worse again.

- [ ] **Write down the output format for the display team**

  They need a stable description of the JSON rather than example code. Write a short
  docs/output_schema.md covering what each field means, the fact that all measurements are
  in millimetres, the fact that positions are measured from the bottom corner of the
  carton, and the fact that the Width, Length and Depth on a placed item are the values
  after rotation, so the display team does not have to work the rotation out themselves.
  Include one complete example response.

  Also confirm with them which axis counts as "up". The solver treats z as the vertical
  axis, which you can see in the sort in src/solver.rs at line 70.

- [ ] **Update the parts of the README that are now out of date**

  The README still says that src/api/handler.rs and src/api/schema.rs are empty and that no
  web framework has been chosen. Both files are written now, and Cargo.toml depends on axum
  0.8 and tokio. The "Known limitations" section also says there is no HTTP layer, which
  will need updating once the server is added.

- [ ] **Choose between models.rs and types.rs, then delete the other one**

  src/types.rs defines a second complete set of types (Container, Placement,
  PackedContainer and Space) covering the same concepts as src/models.rs. It has its own
  passing tests, but nothing in the project uses it. Two sets of types for the same thing
  will drift apart over time.

  Either move the solver and the API across to it, or delete it for now. Keeping both is
  the worst of the options.

  On a related note, src/packer.rs and src/constraints.rs are empty files, and neither is
  listed in src/lib.rs, so they are not compiled at all.

## Not part of the MVP

- Fetching orders from anywhere. There is no order ID, customer, database or queue in the
  project. The /solve endpoint expects the caller to supply the items and carton types
  directly. That is fine for the MVP, but worth stating so nobody assumes it already exists.
- Rewriting packer.rs and constraints.rs. The placement code already in solver.rs produces
  valid layouts, so the rewrite can wait.
- A live 3D viewer. The HTML files in docs/misc are hand drawn pictures rather than a
  renderer, and they say so themselves: "regenerate by hand if the test data changes". For
  the MVP the handover is the JSON, and rendering is the display team's side of the work.
- Rules about stacking order, fragile items, and how much weight an item can bear, beyond
  the basic support check listed above.
