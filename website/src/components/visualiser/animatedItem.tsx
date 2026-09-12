import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { PackedItem } from "./packedItem";
import type { packingItem, vector3Data } from "./types";

interface animatedItemProps {
  item: packingItem;
  containerSize: vector3Data;
  animationDuration?: number;
  topMargin?: number;
}

function smoothStep(fraction: number): number {
  return (3 - 2 * fraction) * fraction * fraction;
}

/* Renders and animates the falling item */
export function AnimatedItem({
  item,
  containerSize,
  animationDuration = 2.5,
  topMargin = 0.1,
}: animatedItemProps) {
  const fallingItemRef = useRef<Mesh>(null);
  const ghostItemRef = useRef<Mesh>(null);
  const elapsedTimeRef = useRef(0);
  const safeAnimationDuration = Math.max(animationDuration, Number.EPSILON);

  useFrame((_state, delta) => {
    elapsedTimeRef.current = (elapsedTimeRef.current + delta) % safeAnimationDuration;

    const progress = elapsedTimeRef.current / safeAnimationDuration;
    const span = topMargin + containerSize.y - item.position.y;
    const animatedBottom = containerSize.y - span * smoothStep(progress) + topMargin;
    const ghostHeight = Math.max(0, Math.min(item.size.y, animatedBottom - item.position.y));

    if (fallingItemRef.current) {
      fallingItemRef.current.position.y = animatedBottom + item.size.y / 2;
    }

    if (ghostItemRef.current) {
      ghostItemRef.current.position.y = item.position.y + ghostHeight / 2;
      ghostItemRef.current.scale.y = item.size.y > 0 ? ghostHeight / item.size.y : 0;
    }
  });

  const fallingItem: packingItem = {
    uuid: item.uuid,
    position: {
      x: item.position.x,
      y: containerSize.y + topMargin,
      z: item.position.z,
    },
    size: {
      x: item.size.x,
      y: item.size.y,
      z: item.size.z,
    },
  };

  return (
    <>
      <PackedItem ref={fallingItemRef} item={fallingItem} color="red" />
      <PackedItem ref={ghostItemRef} item={item} color="red" opacity={0.2} />
    </>
  );
}
