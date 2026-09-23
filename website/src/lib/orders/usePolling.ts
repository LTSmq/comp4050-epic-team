"use client";

import { useEffect, useRef } from "react";

/**
 * Battery-aware polling.
 * - Runs `tick` every `intervalMs` only while the tab is visible and online.
 * - Pauses completely when the screen is off / app backgrounded.
 * - Refreshes immediately when the user comes back (visible / focus / online).
 * - Backs off (x2, max 30s) on errors; never overlaps requests.
 * `tick` may return false to signal failure.
 */
export function usePolling(
  tick: (signal: AbortSignal) => Promise<boolean | void>,
  intervalMs: number,
  enabled = true,
  /** Fire the first tick immediately instead of after one interval. */
  immediate = false
) {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let running = false;
    let failures = 0;
    let stopped = false;

    const canRun = () => document.visibilityState === "visible" && navigator.onLine;

    const schedule = () => {
      clearTimeout(timer);
      if (stopped || !canRun()) return;
      const delay = failures ? Math.min(intervalMs * 2 ** failures, 30000) : intervalMs;
      timer = setTimeout(run, delay);
    };

    const run = async () => {
      if (stopped || running || !canRun()) return;
      running = true;
      controller = new AbortController();
      try {
        const ok = await tickRef.current(controller.signal);
        failures = ok === false ? Math.min(failures + 1, 4) : 0;
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") failures = Math.min(failures + 1, 4);
      } finally {
        running = false;
        schedule();
      }
    };

    const wake = () => {
      if (canRun()) {
        clearTimeout(timer);
        void run();
      } else {
        clearTimeout(timer);
        controller?.abort();
      }
    };

    if (immediate) void run();
    else schedule();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("offline", wake);

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", wake);
    };
  }, [intervalMs, enabled, immediate]);
}
