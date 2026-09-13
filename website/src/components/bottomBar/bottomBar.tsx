import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import styles from "./bottomBar.module.css";

interface bottomBarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  prevLabel?: string;
  nextLabel?: string;
  onRotateCounterclockwise?: () => void;
  onRotateClockwise?: () => void;
}

export function BottomBar({
  onZoomIn,
  onZoomOut,
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  prevLabel = "Previous Item",
  nextLabel = "Next Item",
  onRotateCounterclockwise,
  onRotateClockwise,
}: bottomBarProps) {
  const handlePrev = onPrev ?? onRotateCounterclockwise;
  const handleNext = onNext ?? onRotateClockwise;

  return (
    <aside className={styles.bottomBarWrapper} aria-label="3D Viewport Controls">
      <div className={styles.capsuleTrack}>
        <button
          type="button"
          className={styles.controlButton}
          aria-label="Zoom in"
          onClick={onZoomIn}
        >
          <span className={styles.iconWrapper}>
            <ZoomIn size={16} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className={styles.label}>Zoom in</span>
        </button>

        <button
          type="button"
          className={styles.controlButton}
          aria-label="Zoom out"
          onClick={onZoomOut}
        >
          <span className={styles.iconWrapper}>
            <ZoomOut size={16} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className={styles.label}>Zoom out</span>
        </button>

        <div className={styles.divider} />

        <button
          type="button"
          className={styles.controlButton}
          aria-label={prevLabel}
          onClick={handlePrev}
          disabled={prevDisabled}
        >
          <span className={styles.iconWrapper}>
            <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className={styles.label}>{prevLabel}</span>
        </button>

        <button
          type="button"
          className={styles.controlButton}
          aria-label={nextLabel}
          onClick={handleNext}
          disabled={nextDisabled}
        >
          <span className={styles.iconWrapper}>
            <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className={styles.label}>{nextLabel}</span>
        </button>
      </div>
    </aside>
  );
}

export default BottomBar;
