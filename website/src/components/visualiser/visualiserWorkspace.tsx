"use client";

import type { packingSolution } from "./types";
import { VisualiserCanvas } from "./visualiserCanvas";
import styles from "./visualiser.module.css";

interface visualiserWorkspaceProps {
  solution: packingSolution;
}

/* Connects a packing solution to the canvas */
export function VisualiserWorkspace({ solution }: visualiserWorkspaceProps) {
  return (
    <section className={styles.workspace} aria-label="3D packing visualiser">
      <VisualiserCanvas
        items={solution.items}
        containerSize={solution.containerSize}
      />
    </section>
  );
}
