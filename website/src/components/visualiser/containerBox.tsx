import type { packingItem, vector3Data } from "./types";
import { PackedItem } from "./packedItem";

interface containerBoxProps {
  size: vector3Data;
}

/* Renders the outer box that contains all packed items */
export function ContainerBox({ size }: containerBoxProps) {
  const container: packingItem = {
    uuid: "outerBox",
    position: { x: 0, y: 0, z: 0 },
    size,
  };

  return <PackedItem item={container} color="blue" opacity={0.05} depthTest={false} />;
}
