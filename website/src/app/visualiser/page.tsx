"use client";
import type { ReactElement } from "react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import TopNavBar from "@/components/topNavBar/topNavBar";
import VisualiserClient from "@/components/visualiser-v2/visualiserClient";
import {
  applySolutionResult,
  solutionKey,
  startSolutionPolling,
  type SolutionView,
} from "@/lib/solutionPolling";
import styles from "@/components/visualiser-v2/visualiserPage.module.css";

function VisualiserContent({ requestedOrderId }: { requestedOrderId: string | null }): ReactElement {
  const [view, setView] = useState<SolutionView>({ status: "loading", solution: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => startSolutionPolling(requestedOrderId, (result) => {
    setView((previous) => applySolutionResult(previous, result));
  }), [requestedOrderId, retry]);

  const { solution, status, message } = view;
  const hasPackages = !!solution?.order.packages.length;
  const isStale = solution !== null && status !== "ready" && status !== "empty";
  const retryNow = () => {
    setView((previous) => ({ ...previous, status: "loading", message: undefined }));
    setRetry((previous) => previous + 1);
  };

  return (
    <div className={styles.page}>
      <TopNavBar />
      <div className={styles.status} role={status === "error" ? "alert" : "status"}>
        <div className={styles.statusText}>
          {solution && (
            <div>
              Viewing solution: <strong className={styles.orderId}>{solution.orderId}</strong>
              <span className={styles.received}>
                (Received {new Date(solution.receivedAt).toLocaleTimeString()})
              </span>
            </div>
          )}
          {status === "loading" && <div>Checking for a packing solution…</div>}
          {status === "waiting" && <div className={styles.waiting}>Waiting for solver solution…</div>}
          {status === "empty" && <div>No packages are required for this solution.</div>}
          {status === "error" && <div className={styles.error}>{message}</div>}
          {isStale && <div>Showing the last received solution; it may be out of date.</div>}
        </div>
        {status === "error" && (
          <button type="button" className={styles.retry} onClick={retryNow}>Retry</button>
        )}
      </div>
      <main className={styles.main}>
        {hasPackages && solution ? (
          <VisualiserClient key={solutionKey(solution)} order={solution.order} />
        ) : (
          <p className={styles.empty}>
            {status === "error" ? "The solution could not be displayed. Retry or wait for the next update."
              : status === "empty" ? "This solution contains no packages to display."
                : status === "loading" ? "Loading packing solution…"
                  : "No packing solution has been received yet."}
          </p>
        )}
      </main>
    </div>
  );
}

function RequestedVisualiser(): ReactElement {
  const requestedOrderId = useSearchParams().get("orderId");
  // A changed query must clear the previous order and abort its in-flight request.
  return <VisualiserContent key={JSON.stringify(requestedOrderId)} requestedOrderId={requestedOrderId} />;
}

export default function VisualiserPage(): ReactElement {
  return (
    <Suspense fallback={<div>Loading visualiser…</div>}>
      <RequestedVisualiser />
    </Suspense>
  );
}
