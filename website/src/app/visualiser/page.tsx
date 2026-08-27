import TopNavBar from "@/components/topNavBar/topNavBar";
import type { packingSolution } from "@/components/visualiser/types";
import { VisualiserWorkspace } from "@/components/visualiser/visualiserWorkspace";
import { styles } from "./style";

const initialPackingSolution: packingSolution = {
  containerSize: { x: 1, y: 1, z: 1 },
  items: [],
};

export default function VisualiserPage() {
  return (
    <div style={styles.pageWrapper}>
      <TopNavBar />
      <main style={styles.mainContent}>
        <VisualiserWorkspace solution={initialPackingSolution} />
      </main>
    </div>
  );
}
