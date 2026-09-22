"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TopNavBar from "@/components/topNavBar/topNavBar";
import { VisualiserWorkspace } from "@/components/visualiser/visualiserWorkspace";
import { mockVisualiserCartons } from "@/testData/mockVisualiserData";
import type { VisualiserCarton } from "@/app/lib/types";
import { styles } from "./style";

function VisualiserContent() {
  const searchParams = useSearchParams();
  const requestedOrderId = searchParams.get("orderId");

  const [cartons, setCartons] = useState<VisualiserCarton[]>(mockVisualiserCartons);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [lastReceivedAt, setLastReceivedAt] = useState<string | null>(null);

  const lastReceivedAtRef = useRef<string | null>(null);
  const currentOrderIdRef = useRef<string | null>(null);

  const fetchSolution = useCallback(async () => {
    try {
      const base = requestedOrderId
        ? `/api/solutions?orderId=${encodeURIComponent(requestedOrderId)}`
        : "/api/solutions?latest=true";
      const url = `${base}&_t=${Date.now()}`;

      const res = await fetch(url, {
        cache: "no-store",
        headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;

      const data = await res.json();
      if (data.cartons && data.cartons.length > 0) {
        if (
          data.receivedAt !== lastReceivedAtRef.current ||
          data.orderId !== currentOrderIdRef.current
        ) {
          lastReceivedAtRef.current = data.receivedAt;
          currentOrderIdRef.current = data.orderId;
          setCartons(data.cartons);
          setCurrentOrderId(data.orderId);
          setLastReceivedAt(data.receivedAt);
        }
      }
    } catch (err) {
      console.error("[Visualiser] Error fetching solution:", err);
    }
  }, [requestedOrderId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSolution();
    }, 0);
    const interval = setInterval(() => {
      void fetchSolution();
    }, 2000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchSolution]);


  return (
    <div style={styles.pageWrapper}>
      <TopNavBar />
      <div
        style={{
          padding: "6px 20px",
          backgroundColor: "#1e1e1e",
          color: "#9ca3af",
          fontSize: "13px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #333",
        }}
      >
        <div>
          {currentOrderId ? (
            <span>
              Viewing Solution:{" "}
              <strong style={{ color: "#38bdf8" }}>{currentOrderId}</strong>
              {lastReceivedAt && (
                <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "12px" }}>
                  (Received {new Date(lastReceivedAt).toLocaleTimeString()})
                </span>
              )}
            </span>
          ) : (
            <span style={{ color: "#888" }}>
              Status: <span style={{ color: "#eab308" }}>Waiting for solver solution... (showing default preview)</span>
            </span>
          )}
        </div>
        <button
          onClick={() => fetchSolution()}
          style={{
            padding: "4px 12px",
            fontSize: "12px",
            backgroundColor: "#2a2a2a",
            color: "#e5e7eb",
            border: "1px solid #444",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Check for updates
        </button>
      </div>
      <main style={styles.mainContent}>
        <VisualiserWorkspace solutions={cartons} />
      </main>
    </div>
  );

}

export default function VisualiserClient() {
  return (
    <Suspense fallback={<div>Loading visualiser...</div>}>
      <VisualiserContent />
    </Suspense>
  );
}
