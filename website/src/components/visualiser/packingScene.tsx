import { AnimatedItem } from "./animatedItem";
import { ContainerBox } from "./containerBox";
import { PackedItem } from "./packedItem";
import type { packingItem, vector3Data } from "./types";

interface packingSceneProps {
  items: packingItem[];
  containerSize: vector3Data;
}

/* Builds the three.js scene with lighting/controls/container/packed items */
export function PackingScene({ items, containerSize }: packingSceneProps) {
  const settledItems = items.slice(0, -1);
  const activeItem = items.at(-1);

  return (
    <>
      <ambientLight intensity={2} />
      <ContainerBox size={containerSize} />

      {settledItems.map((item) => (
        <PackedItem key={item.uuid} item={item} opacity={0.95} />
      ))}

      {activeItem && (
        <AnimatedItem key={activeItem.uuid} item={activeItem} containerSize={containerSize} />
      )}
    </>
  );
}
