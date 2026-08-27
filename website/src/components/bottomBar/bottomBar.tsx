import { RotateCcw, RotateCw, type LucideIcon, ZoomIn, ZoomOut } from "lucide-react";
import styles from "./bottomBar.module.css";

interface ControlItem {
  name: string;
  actionKey: keyof bottomBarProps;
  icon: LucideIcon;
}

interface bottomBarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateCounterclockwise: () => void;
  onRotateClockwise: () => void;
}

const controlItems: ControlItem[] = [
  { name: "Zoom in", actionKey: "onZoomIn", icon: ZoomIn },
  { name: "Zoom out", actionKey: "onZoomOut", icon: ZoomOut },

  {
    name: "Rotate -90 Degrees",
    actionKey: "onRotateCounterclockwise",
    icon: RotateCcw,
  },

  {
    name: "Rotate +90 Degrees",
    actionKey: "onRotateClockwise",
    icon: RotateCw,
  },
];

export function BottomBar(props: bottomBarProps) {
  return (
    <aside className={styles.bottomBarWrapper} aria-label="3D Viewport Controls">
      <div className={styles.capsuleTrack}>
        {controlItems.map((item, index) => {
          const Icon = item.icon;

          return (
            <div key={item.actionKey} style={{ display: "flex", alignItems: "center" }}>
              {index === 2 && <div className={styles.divider} />}
              <button type="button" className={styles.controlButton} aria-label={item.name} onClick={props[item.actionKey]}>
                <span className={styles.iconWrapper}>
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className={styles.label}>{item.name}</span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default BottomBar;
