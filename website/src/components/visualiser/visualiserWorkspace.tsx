"use client";

import { calculateCenter, type packingSolution } from "./types";
import { VisualiserCanvas } from "./visualiserCanvas";
import { ItemInfoPanel, ItemInfoRail, ItemNav } from "./itemInfoPanel";
import styles from "./visualiser.module.css";
import BottomBar from "@/components/bottomBar/bottomBar";
import SideMenu from "@/components/sideMenu/sideMenu";
import { useRef, useState} from "react";
import { Vector3, type PerspectiveCamera } from "three";



interface visualiserWorkspaceProps {
  solution: packingSolution;
}

/* Connects a packing solution to the canvas */
export function VisualiserWorkspace({ solution }: visualiserWorkspaceProps) {

  const cameraRef = useRef<PerspectiveCamera>(null);
  const boxCenter = calculateCenter(
    { x: 0, y: 0, z: 0 },
    solution.containerSize,
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const total = solution.items.length;
  const clampedIndex = total === 0 ? 0: Math.min(selectedIndex, total - 1);
  const current = total === 0 ? 0: clampedIndex + 1;

  function selectPrev() {
    setSelectedIndex((index) => Math.max(0, index - 1));
  }

  function selectNext() {
    setSelectedIndex((index) => Math.min(total - 1, index + 1));
  }

  const activeInfo = total == 0 ? undefined: solution.items[clampedIndex];

  function zoomCanvas(scale: number): void {
    const camera = cameraRef.current;
    if (!camera) return;

    camera.zoom *= scale;
    camera.updateProjectionMatrix();
  }

  function rotateAroundBox(radians: number): void {
    const camera = cameraRef.current;
    if (!camera) return;

    camera.position
      .sub(boxCenter)
      .applyAxisAngle(new Vector3(0, 1, 0), radians)
      .add(boxCenter);

    camera.lookAt(boxCenter);
    console.log("Camera position ", camera.position.toArray()); // check in devtools
  }

  return (
    <section className={styles.workspace} aria-label="3D packing visualiser">
      <VisualiserCanvas
        items={solution.items}
        containerSize={solution.containerSize}
        onCameraReady={(camera) => {
          cameraRef.current = camera;
        }}
      />
      <SideMenu
        title = "Item Info Table"
        ariaLabel = "Item Information"
        collapsedContent = {
          <ItemInfoRail current = {current} total = {total}/>
        }
        footer = {
          <ItemNav
            current = {current}
            total = {total}
            onPrev = {selectPrev}
            onNext = {selectNext}
          />
        }
      >
        <ItemInfoPanel item = {activeInfo}/>
      </SideMenu>

      <BottomBar
        onZoomIn={() => zoomCanvas(1.2)}
        onZoomOut={() => zoomCanvas(1 / 1.2)}
        onRotateCounterclockwise={() => rotateAroundBox(-Math.PI / 2)}
        onRotateClockwise={() => rotateAroundBox(Math.PI / 2)}
      />
    </section>
  );
}
