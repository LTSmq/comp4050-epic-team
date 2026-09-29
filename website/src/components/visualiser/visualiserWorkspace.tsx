"use client";

import type { packingSolution } from "./types";
import { VisualiserCanvas } from "./visualiserCanvas";
import { ItemInfoPanel, ItemInfoRail, ItemNav } from "./itemInfoPanel";
import styles from "./visualiser.module.css";
import BottomBar from "@/components/bottomBar/bottomBar";
import SideMenu from "@/components/sideMenu/sideMenu";
import { Package } from "lucide-react";
import { useMemo, useRef, useSyncExternalStore } from "react";
import type { PerspectiveCamera } from "three";

interface visualiserWorkspaceProps {
  solution?: packingSolution;
  solutions?: packingSolution[];
}

const STORAGE_KEY = "visualiser_state";
const DEFAULT_STATE = { box: 0, steps: {} as Record<number, number> };
let snapshot = DEFAULT_STATE;
const listeners = new Set<() => void>();

function getSnapshot() {
  if (snapshot === DEFAULT_STATE && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) snapshot = JSON.parse(raw);
    } catch {}
  }
  return snapshot;
}

function setVisualiserState(updater: (prev: typeof DEFAULT_STATE) => typeof DEFAULT_STATE) {
  snapshot = updater(getSnapshot());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/* Connects a packing solution to the canvas with sequential box support */
export function VisualiserWorkspace({ solution, solutions }: visualiserWorkspaceProps) {
  const cameraRef = useRef<PerspectiveCamera>(null);
  const activeSolutions = useMemo(
    () => (solutions && solutions.length > 0 ? solutions : solution ? [solution] : []),
    [solutions, solution]
  );

  const { box, steps } = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_STATE);
  const boxIndex = Math.min(Math.max(0, box), Math.max(0, activeSolutions.length - 1));
  const activeSolution = activeSolutions[boxIndex] ?? {
    containerSize: { x: 1, y: 1, z: 1 },
    items: [],
  };

  const total = activeSolution.items.length;
  const placedCount = Math.min(Math.max(0, steps[boxIndex] ?? 0), total);

  const handleSelectBox = (index: number) =>
    setVisualiserState((prev) => ({ ...prev, box: index }));

  const selectPrev = () => {
    if (placedCount > 0) {
      setVisualiserState((prev) => ({
        ...prev,
        steps: { ...prev.steps, [boxIndex]: placedCount - 1 },
      }));
    }
  };

  const selectNext = () => {
    if (placedCount < total) {
      setVisualiserState((prev) => ({
        ...prev,
        steps: { ...prev.steps, [boxIndex]: placedCount + 1 },
      }));
    }
  };

  const panelItem =
    total === 0 ? undefined : activeSolution.items[Math.max(0, placedCount - 1)];
  const panelStatus =
    total === 0 ? undefined : placedCount === 0 ? "Ready to place" : "Placed";

  function zoomCanvas(scale: number): void {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.zoom *= scale;
    camera.updateProjectionMatrix();
  }

  const boxTitle = activeSolution.boxReference
    ? `Item Info (${activeSolution.boxReference})`
    : "Item Info Table";

  const visibleItems = activeSolution.items.slice(0, placedCount);

  return (
    <section className={styles.workspace} aria-label="3D packing visualiser">
      <div className={styles.canvasWrapper}>
        {activeSolutions.length > 1 && (
          <div className={styles.tabBar} role="tablist" aria-label="Carton Selection Tabs">
            {activeSolutions.map((sol, index) => {
              const isActive = index === boxIndex;
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
          key={`box-${boxIndex}`}
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
        collapsedContent={<ItemInfoRail current={placedCount} total={total} />}
        footer={
          <ItemNav
            current={placedCount}
            total={total}
            onPrev={selectPrev}
            onNext={selectNext}
          />
        }
      >
        <ItemInfoPanel item={panelItem} status={panelStatus} />
      </SideMenu>

      <BottomBar
        onZoomIn={() => zoomCanvas(1.2)}
        onZoomOut={() => zoomCanvas(1 / 1.2)}
        onPrev={selectPrev}
        onNext={selectNext}
        prevDisabled={placedCount <= 0}
        nextDisabled={placedCount >= total}
        prevLabel="Previous Item"
        nextLabel="Next Item"
      />
    </section>
  );
}
