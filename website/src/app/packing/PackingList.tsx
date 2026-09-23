"use client";

/**
 * Live packing list. Pulls only changed orders every 2s, pauses when the
 * screen is off. Oldest ready order first. One tap opens the order.
 */
import Link from "next/link";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import type { Role } from "@/lib/rbac";
import { usePolling } from "@/lib/orders/usePolling";
import {
  PACKED_WINDOW_MS,
  formatAge,
  isClaimStale,
  progressLabel,
  type OrderProgress,
  type PackingRow,
} from "@/lib/orders/progress";
import styles from "./packing.module.css";

type Props = {
  role: Role;
  userId: string;
  initialRows: PackingRow[];
  initialNow: string;
  initialCursor: string;
};

type Tab = "todo" | "packed" | "hold";

const TONE: Partial<Record<OrderProgress, string>> = {
  ready: styles.toneReady,
  packing: styles.toneActive,
  packed: styles.toneDone,
  on_hold: styles.toneWarn,
  failed: styles.toneWarn,
};

/** Status pill shared by the list and the order screen. */
export function StatusChip({ progress, text }: { progress: OrderProgress; text?: string }) {
  return (
    <span className={`${styles.chip} ${TONE[progress] ?? ""}`}>
      {text ?? progressLabel(progress, "team")}
    </span>
  );
}

const by = (key: keyof PackingRow, dir: 1 | -1) => (a: PackingRow, b: PackingRow) =>
  dir * (String(a[key] ?? "").localeCompare(String(b[key] ?? "")) || a.orderId.localeCompare(b.orderId));

export default function PackingList({ role, userId, initialRows, initialNow, initialCursor }: Props) {
  const [rows, setRows] = useState(() => new Map(initialRows.map((r) => [r.orderId, r])));
  const [cursor, setCursor] = useState(initialCursor);
  const [now, setNow] = useState(initialNow);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>("todo");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim().toLowerCase());
  const supervisor = role === "supervisor";
  const nowMs = Date.parse(now);

  // Live updates: only rows changed since the last poll.
  const tick = useCallback(
    async (signal: AbortSignal) => {
      const res = await fetch(`/api/packing?since=${encodeURIComponent(cursor)}`, {
        cache: "no-store",
        signal,
      });
      if (!res.ok) {
        setOffline(true);
        return false;
      }
      const data = (await res.json()) as {
        reset: boolean;
        rows: PackingRow[];
        cursor: string;
        now: string;
      };
      setOffline(false);
      setCursor(data.cursor);
      setNow(data.now);
      if (data.reset) {
        setRows(new Map(data.rows.map((r) => [r.orderId, r])));
      } else if (data.rows.length) {
        setRows((prev) => {
          const next = new Map(prev);
          for (const r of data.rows) next.set(r.orderId, r);
          return next;
        });
      }
      return true;
    },
    [cursor]
  );
  usePolling(tick, 2000);

  const lists = useMemo(() => {
    const ready: PackingRow[] = [];
    const busy: PackingRow[] = [];
    const packed: PackingRow[] = [];
    const hold: PackingRow[] = [];
    let mine: PackingRow | null = null;
    const packedSince = nowMs - PACKED_WINDOW_MS;

    for (const r of rows.values()) {
      if (
        query &&
        !r.orderId.toLowerCase().includes(query) &&
        !r.customerName.toLowerCase().includes(query)
      ) {
        continue;
      }
      const stale = isClaimStale(r, nowMs);
      if (r.progress === "packing" && r.packer?.id === userId && !stale) mine = r;
      else if (r.progress === "ready" || stale) ready.push(r);
      else if (r.progress === "packing") busy.push(r);
      else if (r.progress === "packed" && r.packedAt && Date.parse(r.packedAt) >= packedSince) packed.push(r);
      else if (r.progress === "on_hold") hold.push(r);
    }
    ready.sort(by("solvedAt", 1));
    busy.sort(by("claimedAt", 1));
    packed.sort(by("packedAt", -1));
    hold.sort(by("updatedAt", 1));
    return { mine, todo: [...ready, ...busy], readyCount: ready.length, packed, hold };
  }, [rows, query, userId, nowMs]);

  const shown = tab === "todo" ? lists.todo : tab === "packed" ? lists.packed : lists.hold;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.listHeader}>
          <div>
            <h1>Packing</h1>
            <p className={offline ? styles.offline : styles.live}>
              <i aria-hidden="true" />
              {offline ? "Reconnecting…" : "Live"}
            </p>
          </div>
          <strong className={styles.bigCount}>
            {lists.readyCount}
            <small>ready</small>
          </strong>
        </header>

        {lists.mine && (
          <Link href={`/packing/${encodeURIComponent(lists.mine.orderId)}`} className={styles.mine}>
            <span>You are packing</span>
            <strong>{lists.mine.orderId}</strong>
            <em>Continue →</em>
          </Link>
        )}

        <input
          className={styles.search}
          type="search"
          enterKeyHint="search"
          placeholder="Scan or search order / customer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search orders"
        />

        <nav className={styles.tabs} role="tablist">
          <TabButton on={tab === "todo"} onClick={() => setTab("todo")} label="To pack" n={lists.todo.length} />
          <TabButton on={tab === "packed"} onClick={() => setTab("packed")} label="Packed" n={lists.packed.length} />
          {supervisor && (
            <TabButton on={tab === "hold"} onClick={() => setTab("hold")} label="On hold" n={lists.hold.length} />
          )}
        </nav>

        {shown.length === 0 ? (
          <p className={styles.empty}>
            {tab === "todo"
              ? "Nothing to pack right now."
              : tab === "packed"
                ? "Nothing packed in the last 12 hours."
                : "No orders on hold."}
          </p>
        ) : (
          <ul className={styles.list}>
            {shown.map((o) => (
              <Row key={o.orderId} order={o} nowMs={nowMs} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function TabButton({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button type="button" role="tab" aria-selected={on} className={on ? styles.tabOn : styles.tab} onClick={onClick}>
      {label} <span>{n}</span>
    </button>
  );
}

function Row({ order, nowMs }: { order: PackingRow; nowMs: number }) {
  const stale = isClaimStale(order, nowMs);
  const busy = order.progress === "packing" && !stale;

  let chip: string | undefined;
  let meta: string;
  if (order.progress === "packing") {
    chip = stale ? "Abandoned" : `Packing · ${order.packer?.name ?? "?"}`;
    meta = formatAge(order.claimedAt, nowMs);
  } else if (order.progress === "packed") {
    chip = `Packed · ${order.packedBy?.name ?? "?"}`;
    meta = `${formatAge(order.packedAt, nowMs)} ago`;
  } else if (order.progress === "on_hold") {
    meta = `Item ${order.holdItemCode ?? "?"} unavailable`;
  } else {
    meta = `waiting ${formatAge(order.solvedAt, nowMs)}`;
  }

  return (
    <li>
      <Link
        href={`/packing/${encodeURIComponent(order.orderId)}`}
        prefetch={false}
        className={`${styles.row} ${busy ? styles.rowBusy : ""}`}
      >
        <div className={styles.rowMain}>
          <strong>{order.orderId}</strong>
          <span>
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
            {" · "}
            {order.customerName}
          </span>
        </div>
        <div className={styles.rowSide}>
          <StatusChip progress={stale ? "ready" : order.progress} text={chip} />
          <small>{meta}</small>
        </div>
      </Link>
    </li>
  );
}