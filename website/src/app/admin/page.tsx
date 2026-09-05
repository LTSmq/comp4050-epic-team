"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type ManagedUser = { id: string; username: string; email: string; role: "user" | "supervisor" };

export default function AdminPage() {
  const [role, setRole] = useState<string | undefined>();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const me = await (await fetch("/api/auth/me")).json();
      setRole(me.user?.role);
      if (me.user?.role !== "supervisor") return;
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error((await res.json()).message || "Failed to load users.");
      setUsers((await res.json()).users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function changeRole(id: string, next: "user" | "supervisor") {
    setBusy(id); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Update failed.");
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: next } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <main style={S.wrap}><p style={S.muted}>Loading…</p></main>;
  if (role !== "supervisor")
    return (
      <main style={S.wrap}>
        <h1 style={S.h1}>Access denied</h1>
        <p style={S.muted}>You need supervisor access to manage users.</p>
        <Link href="/portal" style={S.link}>← Back to portal</Link>
      </main>
    );

  return (
    <main style={S.wrap}>
      <Link href="/portal" style={S.link}>← Back to portal</Link>
      <p style={S.eyebrow}>TEAM ACCESS</p>
      <h1 style={S.h1}>Manage supervisors</h1>
      <p style={S.muted}>Supervisors can create and edit orders and manage who else is a supervisor.</p>
      {error && <div style={S.error}>{error}</div>}
      <div style={S.table}>
        {users.map((u) => (
          <div key={u.id} style={S.row}>
            <div>
              <div style={S.name}>{u.username}</div>
              <div style={S.email}>{u.email}</div>
            </div>
            <div style={S.actions}>
              <span style={u.role === "supervisor" ? S.badgeSup : S.badgeUser}>{u.role}</span>
              {u.role === "supervisor" ? (
                <button style={S.btnGhost} disabled={busy === u.id} onClick={() => changeRole(u.id, "user")}>
                  {busy === u.id ? "…" : "Remove supervisor"}
                </button>
              ) : (
                <button style={S.btnPrimary} disabled={busy === u.id} onClick={() => changeRole(u.id, "supervisor")}>
                  {busy === u.id ? "…" : "Make supervisor"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 760, margin: "0 auto", padding: "48px 24px", color: "#141414", fontFamily: "system-ui, sans-serif" },
  link: { color: "#8a7d5c", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 20 },
  eyebrow: { letterSpacing: "0.14em", fontSize: 12, color: "#9a8f77", margin: 0, fontWeight: 700 },
  h1: { fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", margin: "6px 0 8px" },
  muted: { color: "#6b6b6b", margin: "0 0 24px" },
  table: { border: "1px solid #e7e2d6", borderRadius: 12, overflow: "hidden", background: "#fff" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 18px", borderTop: "1px solid #f0ece1" },
  name: { fontWeight: 600 },
  email: { color: "#8a8a8a", fontSize: 13 },
  actions: { display: "flex", alignItems: "center", gap: 12 },
  badgeSup: { background: "#f4ad19", color: "#1a1300", fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 999 },
  badgeUser: { background: "#efece3", color: "#6b6b6b", fontSize: 12, padding: "3px 10px", borderRadius: 999 },
  btnPrimary: { background: "#141414", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" },
  btnGhost: { background: "transparent", color: "#141414", border: "1px solid #d9d3c5", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" },
  error: { background: "#fdece9", border: "1px solid #f5b8ac", color: "#b23", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 13 },
};