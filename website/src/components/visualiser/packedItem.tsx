import { Box, Edges } from "@react-three/drei";
import { forwardRef } from "react";
import type { Mesh } from "three";
import { calculateCenter, toVector3, type packingItem } from "./types";

interface packedItemProps {
  item: packingItem;
  opacity?: number;
  color?: string;
  depthTest?: boolean;
}

/* Renders one packing item as a positioned/sized/outlined 3D box */
export const PackedItem = forwardRef<Mesh, packedItemProps>(function PackedItem(
  { item, opacity = 1, color = "#AAAAAA", depthTest = true },
  ref,
) {
  const size = toVector3(item.size);
  const center = calculateCenter(item.position, item.size);

  return (
    <Box ref={ref} position={center} args={size.toArray()}>
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        depthTest={depthTest}
      />
      <Edges color="black" lineWidth={3} />
    </Box>
  );
});
