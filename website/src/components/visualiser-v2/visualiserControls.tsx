import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { DisplayState, VisualiserAction } from "@/lib/visualiserState";
import styles from "./visualiserControls.module.css";

interface VisualiserControlsProps {
  displayState: DisplayState;
  dispatch: (action: VisualiserAction) => void;
  canStepPreviousPackage: boolean;
  canStepNextPackage: boolean;
  canInspectItems: boolean;
  canStepPreviousItem: boolean;
  canStepNextItem: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

interface ControlButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

function ControlButton({ label, icon: Icon, onClick, disabled }: ControlButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

export default function VisualiserControls({
  displayState,
  dispatch,
  canStepPreviousPackage,
  canStepNextPackage,
  canInspectItems,
  canStepPreviousItem,
  canStepNextItem,
  onZoomIn,
  onZoomOut,
}: VisualiserControlsProps) {
  const inspectingPackage = displayState !== "order";
  const inspectingItems = displayState === "items";

  return (
    <aside className={styles.wrapper} aria-label="Visualiser controls">
      <div className={styles.track} role="group" aria-label="Packing navigation and zoom">
        <ControlButton label="Zoom out" icon={ZoomOut} onClick={onZoomOut} />
        <ControlButton label="Zoom in" icon={ZoomIn} onClick={onZoomIn} />

        <span className={styles.divider} />

        <ControlButton
          label="Previous package"
          icon={ChevronsLeft}
          disabled={!canStepPreviousPackage}
          onClick={() => dispatch({ type: "stepPackage", by: -1 })}
        />
        <ControlButton
          label="Inspect package items"
          icon={Search}
          disabled={displayState !== "package" || !canInspectItems}
          onClick={() => dispatch({ type: "inspect", mode: "items" })}
        />

        <span className={styles.divider} />

        <ControlButton
          label="Previous item"
          icon={ArrowLeft}
          disabled={!inspectingItems || !canStepPreviousItem}
          onClick={() => dispatch({ type: "stepItem", by: -1 })}
        />
        {inspectingItems ? (
          <ControlButton
            label="Inspect package"
            icon={Box}
            onClick={() => dispatch({ type: "inspect", mode: "package" })}
          />
        ) : (
          <ControlButton
            label="Back to all packages"
            icon={LayoutGrid}
            disabled={!inspectingPackage}
            onClick={() => dispatch({ type: "selectPackage", index: null })}
          />
        )}
        <ControlButton
          label="Next item"
          icon={ArrowRight}
          disabled={!inspectingItems || !canStepNextItem}
          onClick={() => dispatch({ type: "stepItem", by: 1 })}
        />

        <span className={styles.divider} />

        <ControlButton
          label="Next package"
          icon={ChevronsRight}
          disabled={!canStepNextPackage}
          onClick={() => dispatch({ type: "stepPackage", by: 1 })}
        />
      </div>
    </aside>
  );
}
