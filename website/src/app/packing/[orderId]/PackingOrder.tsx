"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Role } from "@/lib/rbac";
import { usePolling } from "@/lib/orders/usePolling";
import {
  formatAge,
  isClaimStale,
  type PackAction,
  type PackingDetail,
} from "@/lib/orders/progress";
import { StatusChip } from "../PackingList";
import styles from "../packing.module.css";

type Props = { initial: PackingDetail; initialNow: string; role: Role; userId: string };

export default function PackingOrder({ initial, initialNow, role, userId }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [now, setNow] = useState(initialNow);
  const [busy, setBusy] = useState<PackAction | null>(null);
  const [error, setError] = useState("");

  const supervisor = role === "supervisor";
  const nowMs = Date.parse(now);
  const stale = isClaimStale(order, nowMs);
  const mine = order.progress === "packing" && order.packer?.id === userId && !stale;
  const otherPacking = order.progress === "packing" && !mine && !stale;
  // A layout exists once the solver has delivered (order reached "ready").
  const has3D = order.solvedAt !== null;
  const canFlag = mine || (supervisor && (order.progress === "ready" || order.progress === "packing"));
  const url = `/api/packing/${encodeURIComponent(order.orderId)}`;

  // Live: someone else claims it, supervisor decisions, etc. 204 when nothing changed.
  const tick = useCallback(
    async (signal: AbortSignal) => {
      const res = await fetch(`${url}?since=${encodeURIComponent(order.updatedAt ?? "")}`, {
        cache: "no-store",
        signal,
      });
      if (res.status === 204) return true;
      if (res.status === 404) {
        router.replace("/packing");
        return true;
      }
      if (!res.ok) return false;
      const data = (await res.json()) as { order: PackingDetail; now: string };
      setOrder(data.order);
      setNow(data.now);
      return true;
    },
    [url, order.updatedAt, router]
  );
  usePolling(tick, 3000, busy === null);

  async function act(action: PackAction, itemIndex?: number) {
    setBusy(action);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemIndex }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Action failed.");
        const fresh = await fetch(url, { cache: "no-store" }); // show the truth
        if (fresh.ok) {
          const d = await fresh.json();
          setOrder(d.order);
          setNow(d.now);
        }
        return;
      }
      setOrder(data.order);
      setNow(data.now);
      if (action === "packed") router.push("/packing"); // straight to the next order
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function flagUnavailable(i: number) {
    const item = order.items[i];
    if (
      window.confirm(
        `Mark ${item.ItemReference} (${item.ItemCode}) as unavailable?\nThe order goes on hold for a supervisor.`
      )
    ) {
      void act("unavailable", i);
    }
  }

  const statusLine = (() => {
    switch (order.progress) {
      case "packing":
        if (mine) return `You started ${formatAge(order.claimedAt, nowMs)} ago`;
        return stale
          ? `Abandoned by ${order.packer?.name} — you can take it over`
          : `Being packed by ${order.packer?.name} · ${formatAge(order.claimedAt, nowMs)}`;
      case "packed":
        return `Packed by ${order.packedBy?.name} · ${formatAge(order.packedAt, nowMs)} ago`;
      case "on_hold":
        return `Item ${order.holdItemCode} unavailable — waiting for supervisor`;
      case "ready":
        return `Ready ${formatAge(order.solvedAt, nowMs)} ago`;
      default:
        return "Waiting for packing layout";
    }
  })();

  const btn = (action: PackAction, label: string, kind: "primary" | "secondary" | "danger" = "primary") => (
    <button type="button" className={styles[kind]} disabled={busy !== null} onClick={() => void act(action)}>
      {busy === action ? "…" : label}
    </button>
  );

  const open3D = has3D && (
    <Link href={`/visualiser?orderId=${encodeURIComponent(order.orderId)}`} className={styles.secondary}>
      Open 3D
    </Link>
  );

  let actions: React.ReactNode = null;
  if (order.progress === "ready" || stale) {
    actions = (<>{open3D}{btn("claim", stale ? "Take over" : "Start packing")}</>);
  } else if (mine) {
    actions = (<>{btn("release", "Release", "secondary")}{open3D}{btn("packed", "Mark packed")}</>);
  } else if (otherPacking) {
    actions = (<>{open3D}{supervisor && btn("release", "Force release", "danger")}</>);
  } else if (order.progress === "packed") {
    actions = (<>{open3D}{supervisor && btn("reopen", "Undo packed", "secondary")}</>);
  } else if (order.progress === "on_hold" && supervisor) {
    actions = (<>{btn("resolve", "Re-solve without item", "secondary")}{btn("restore", "Item found")}</>);
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.container} ${styles.withBar}`}>
        <Link href="/packing" className={styles.back}>
          ← Packing list
        </Link>

        <header className={styles.detailHeader}>
          <div>
            <h1>{order.orderId}</h1>
            <p>{order.customerName}</p>
          </div>
          <StatusChip progress={stale ? "ready" : order.progress} text={stale ? "Abandoned" : undefined} />
        </header>

        <p className={styles.statusLine}>{statusLine}</p>

        <dl className={styles.facts}>
          <div>
            <dt>Items</dt>
            <dd>{order.items.length}</dd>
          </div>
          <div>
            <dt>Unavailable</dt>
            <dd>{order.items.filter((i) => i.unavailable).length}</dd>
          </div>
        </dl>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <ol className={styles.items}>
          {order.items.map((item, i) => (
            <li key={`${item.ItemCode}-${i}`} className={item.unavailable ? styles.itemOut : undefined}>
              <span className={styles.itemNo}>{String(i + 1).padStart(2, "0")}</span>
              <div className={styles.itemBody}>
                <strong>{item.ItemReference}</strong>
                <span>
                  {item.ItemCode} · {item.Width}×{item.Length}×{item.Depth}
                  {item.BoxGroup ? ` · group ${item.BoxGroup}` : ""}
                </span>
              </div>
              {item.unavailable ? (
                <em className={styles.outTag}>Unavailable</em>
              ) : (
                canFlag && (
                  <button
                    type="button"
                    className={styles.flag}
                    disabled={busy !== null}
                    onClick={() => flagUnavailable(i)}
                  >
                    Unavailable
                  </button>
                )
              )}
            </li>
          ))}
        </ol>
      </div>

      {actions && <div className={styles.actionBar}>{actions}</div>}
    </main>
  );
}