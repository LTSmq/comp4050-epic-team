import TopNavBar from "@/components/topNavBar/topNavBar";
import { VisualiserWorkspace } from "@/components/visualiser/visualiserWorkspace";
import { mockVisualiserCartons } from "@/testData/mockVisualiserData";
import { styles } from "./style";

export default function VisualiserPage() {
  return (
    <div style={styles.pageWrapper}>
      <TopNavBar />
      <main style={styles.mainContent}>
        <VisualiserWorkspace solutions={mockVisualiserCartons} />
      </main>
    </div>
  );
}
