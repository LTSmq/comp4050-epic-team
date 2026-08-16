import { RotateCcw, RotateCw, type LucideIcon, ZoomIn, ZoomOut } from "lucide-react";
import styles from "./bottomBar.module.css";

interface ControlItem {
  name: string;
  actionKey: string;
  icon: LucideIcon;
}

const controlItems: ControlItem[] = [
  { name: "Zoom in", actionKey: "zoom-in", icon: ZoomIn },
  { name: "Zoom out", actionKey: "zoom-out", icon: ZoomOut },
  { name: "Rotate -90 Degrees", actionKey: "rotate-ccw", icon: RotateCcw },
  { name: "Rotate +90 Degrees", actionKey: "rotate-cw", icon: RotateCw },
];

export function BottomBar() {
  return (
    <aside className={styles.bottomBarWrapper} aria-label="3D Viewport Controls">
      <div className={styles.capsuleTrack}>
        {controlItems.map((item, index) => {
          const Icon = item.icon;

          return (
            <div key={item.actionKey} style={{ display: "flex", alignItems: "center" }}>
              {index === 2 && <div className={styles.divider} />}
              <button type="button" className={styles.controlButton} aria-label={item.name}>
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
