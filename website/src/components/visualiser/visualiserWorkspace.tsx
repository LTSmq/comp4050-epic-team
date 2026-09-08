"use client";

import type { packingSolution } from "./types";
import { VisualiserCanvas } from "./visualiserCanvas";
import { ItemInfoPanel, ItemInfoRail, ItemNav } from "./itemInfoPanel";
import styles from "./visualiser.module.css";
import BottomBar from "@/components/bottomBar/bottomBar";
import SideMenu from "@/components/sideMenu/sideMenu";
import { Package } from "lucide-react";
import { useRef, useState } from "react";
import type { PerspectiveCamera } from "three";

interface visualiserWorkspaceProps {
  solution?: packingSolution;
  solutions?: packingSolution[];
}

/* Connects a packing solution to the canvas with sequential box support */
export function VisualiserWorkspace({ solution, solutions }: visualiserWorkspaceProps) {
  const cameraRef = useRef<PerspectiveCamera>(null);

  // Normalize solutions: supports both a single solution or an array of cartons
  const activeSolutions = solutions && solutions.length > 0 ? solutions : solution ? [solution] : [];
  const [selectedBoxIndex, setSelectedBoxIndex] = useState(0);

  const clampedBoxIndex = activeSolutions.length === 0 ? 0 : Math.min(selectedBoxIndex, activeSolutions.length - 1);
  const activeSolution = activeSolutions[clampedBoxIndex] ?? {
    containerSize: { x: 1, y: 1, z: 1 },
    items: [],
  };
  const [selectedIndex, setSelectedIndex] = useState(0);

  function handleSelectBox(index: number) {
    setSelectedBoxIndex(index);
    setSelectedIndex(0);
  }
  const total = activeSolution.items.length;
  const clampedIndex = total === 0 ? 0 : Math.min(selectedIndex, total - 1);
  const current = total === 0 ? 0 : clampedIndex + 1;

  function selectPrev() {
    setSelectedIndex((index) => Math.max(0, index - 1));
  }

  function selectNext() {
    setSelectedIndex((index) => Math.min(total - 1, index + 1));
  }

  const activeInfo = total === 0 ? undefined : activeSolution.items[clampedIndex];

  function zoomCanvas(scale: number): void {
    const camera = cameraRef.current;
    if (!camera) return;

    camera.zoom *= scale;
    camera.updateProjectionMatrix();
  }

  const boxTitle = activeSolution.boxReference
    ? `Item Info (${activeSolution.boxReference})`
    : "Item Info Table";

  const visibleItems = activeSolution.items.slice(0, clampedIndex + 1);

  return (
    <section className={styles.workspace} aria-label="3D packing visualiser">
      <div className={styles.canvasWrapper}>
        {activeSolutions.length > 1 && (
          <div className={styles.tabBar} role="tablist" aria-label="Carton Selection Tabs">
            {activeSolutions.map((sol, index) => {
              const isActive = index === clampedBoxIndex;
              const boxLabel = sol.boxReference
                ? `Box ${index + 1}: ${sol.boxReference}`
                : `Box ${index + 1}`;
              const count = sol.items.length;
              return (
                <button
                  key={`box-tab-${index}`}
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                  onClick={() => handleSelectBox(index)}
                >
                  <Package size={14} className={styles.tabIcon} />
                  <span className={styles.tabLabel}>{boxLabel}</span>
                  <span className={styles.tabBadge}>
                    {count} {count === 1 ? "item" : "items"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <VisualiserCanvas
          key={`box-${clampedBoxIndex}`}
          items={visibleItems}
          containerSize={activeSolution.containerSize}
          onCameraReady={(camera) => {
            cameraRef.current = camera;
          }}
        />
      </div>
      <SideMenu
        title={boxTitle}
        ariaLabel="Item Information"
        collapsedContent={
          <ItemInfoRail current={current} total={total} />
        }
        footer={
          <ItemNav
            current={current}
            total={total}
            onPrev={selectPrev}
            onNext={selectNext}
          />
        }
      >
        <ItemInfoPanel item={activeInfo} />
      </SideMenu>

      <BottomBar
        onZoomIn={() => zoomCanvas(1.2)}
        onZoomOut={() => zoomCanvas(1 / 1.2)}
        onPrev={selectPrev}
        onNext={selectNext}
        prevDisabled={clampedIndex <= 0}
        nextDisabled={clampedIndex >= total - 1}
        prevLabel="Previous Item"
        nextLabel="Next Item"
      />
    </section>
  );
}
