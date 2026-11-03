"use strict";

// Turns a /solve answer into the shape these test pages draw from.
//
// The solver now answers in the visualiser's shape: an id and a list of
// packages, each a carton size plus item positions and sizes, with no names and
// no weights. The pages were written against the older, richer answer, which
// named every carton and item and listed what fitted nowhere. Rather than
// rewrite the drawing code, this rebuilds that older shape, so the rest of each
// page is unchanged and the older *_solved.json files next to it still load.
//
// When the page knows the request it sent, the missing detail is recovered from
// it. A carton is named by finding the box type with the same size. An item is
// named by finding a requested item with the same three sides, in any order,
// since the solver may have rotated it, and each requested item is used once.
// Two different items with identical sides can be told apart by nothing in the
// answer, so between those the match is a guess, and only the code and weight
// shown can be wrong, never the geometry. Whatever was requested but never
// matched is what the solver could not pack.
//
// Without the request, as for a file picked from disk, items are labelled by
// their size and weights and leftovers are reported as unknown.
function toPackingResponse(data, request) {
  if (data && Array.isArray(data.PackedBoxes)) return data;
  if (!data || !Array.isArray(data.packages)) return null;

  const boxTypes = (request && request.BoxTypes) || [];
  const pool = request ? request.Items.map(item => ({ item, used: false })) : null;
  const sides = (a, b, c) => [a, b, c].sort((p, q) => p - q).join("x");

  const PackedBoxes = data.packages.map((pkg, index) => {
    const known = boxTypes.find(t =>
      t.Width === pkg.size.x && t.Length === pkg.size.y && t.Depth === pkg.size.z);
    const BoxType = known || {
      Reference: "carton",
      Width: pkg.size.x,
      Length: pkg.size.y,
      Depth: pkg.size.z
    };

    const PlacedItems = pkg.items.map(placed => {
      const key = sides(placed.size.x, placed.size.y, placed.size.z);
      let Item = null;
      if (pool) {
        const match = pool.find(entry =>
          !entry.used && sides(entry.item.Width, entry.item.Length, entry.item.Depth) === key);
        if (match) {
          match.used = true;
          Item = match.item;
        }
      }
      return {
        Item: Item || {
          ItemCode: key,
          ItemReference: "",
          Width: placed.size.x,
          Length: placed.size.y,
          Depth: placed.size.z,
          Weight: null
        },
        X: placed.position.x,
        Y: placed.position.y,
        Z: placed.position.z,
        Width: placed.size.x,
        Length: placed.size.y,
        Depth: placed.size.z
      };
    });

    return { BoxIndex: index, BoxType, PlacedItems };
  });

  return {
    OrderId: data.id,
    PackedBoxes,
    // Null rather than empty when there is no request to compare against, so
    // the page can say it does not know instead of claiming nothing was left.
    UnpackedItems: pool ? pool.filter(entry => !entry.used).map(entry => entry.item) : null
  };
}

// Gross weight of a carton, or null when any item in it has no known weight.
function grossWeight(box) {
  let total = box.BoxType.BoxWeight || 0;
  for (const p of box.PlacedItems) {
    if (p.Item.Weight == null) return null;
    total += p.Item.Weight;
  }
  return total;
}
