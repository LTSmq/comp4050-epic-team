"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import TopNavBar from "@/components/topNavBar/topNavBar";
import type { packingSolution } from "@/components/visualiser/types";
import { VisualiserWorkspace } from "@/components/visualiser/visualiserWorkspace";
import OrderForm from "@/app/orders/OrderForm";

import { styles } from "./style";

const initialPackingSolution: packingSolution = {
  containerSize: { x: 1, y: 1, z: 1 },
  items: [],
};

function VisualiserContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "visualiser";

  return (
    <div style={styles.pageWrapper}>
      <TopNavBar />

      <main style={styles.mainContent}>
        {tab === "orders" ? (
          <OrderForm embedded />
        ) : (
          <VisualiserWorkspace solution={initialPackingSolution} />
        )}
      </main>
    </div>
  );
}

export default function VisualiserPage() {
  return (
    <Suspense fallback={null}>
      <VisualiserContent />
    </Suspense>
  );
}
