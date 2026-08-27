import { Canvas } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { PackingScene } from "./packingScene";
import { calculateCenter, type packingItem, type vector3Data } from "./types";
import styles from "./visualiser.module.css";

interface visualiserCanvasProps {
  items: packingItem[];
  containerSize: vector3Data;
  onCameraReady: (camera: PerspectiveCamera) => void;
}

/* Creates the canvas and places the packing scene inside it */
export function VisualiserCanvas({ items, containerSize, onCameraReady }: visualiserCanvasProps) {
  const center = calculateCenter({ x: 0, y: 0, z: 0 }, containerSize);

  return (
    <div className={styles.canvasContainer}>
      <Canvas
        className={styles.canvas}
        camera={{ position: [0, center.y, containerSize.z * 3] }}

        onCreated={({ camera }) => {
          camera.lookAt(center);
          onCameraReady(camera as PerspectiveCamera);
        }}
      >
        <PackingScene items={items} containerSize={containerSize} />
      </Canvas>
    </div>
  );
}
