export function normaliseSolverResponse(
  response: any
) {
  return {
    ...response,

    PackedBoxes:
      response.PackedBoxes?.map(
        (box: any) => ({
          BoxIndex: box.box_index,
          BoxType: box.box_type,

          PlacedItems:
            box.placed_items?.map(
              (placed: any) => ({
                Item: placed.item,
                X: placed.x,
                Y: placed.y,
                Z: placed.z,
                Width: placed.width,
                Length: placed.length,
                Depth: placed.depth,
              })
            ) ?? [],
        })
      ) ?? [],
  };
}