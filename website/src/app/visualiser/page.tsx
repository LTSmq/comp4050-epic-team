"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import TopNavBar from "@/components/topNavBar/topNavBar";
import BottomBar from "@/components/bottomBar/bottomBar";
import OrderForm from "@/app/orders/OrderForm";

import { styles } from "./style";

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
          <div style={styles.visualiserWorkspace}>
            <aside style={styles.sidePanel} />
            <div style={styles.canvas} />
            <div style={styles.controlBar} />
          </div>
        )}
      </main>

      <BottomBar />
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