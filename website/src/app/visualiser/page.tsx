"use client";

import TopNavBar from "@/components/topNavBar/topNavBar";
import BottomBar from "@/components/bottomBar/bottomBar";
import { styles } from "./style";

export default function VisualiserPage() {
  return (
    <div style={styles.pageWrapper}>
      <TopNavBar />
      <main style={styles.mainContent} />
      <BottomBar />
    </div>
  );
}
