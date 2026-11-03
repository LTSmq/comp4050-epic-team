"use client";

import { useEffect, useState } from "react";
import type { Role } from "./rbac";

/** Client-side role and user id, read from the auth cookie via /api/auth/me. */
export function useRole() {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        setRole(data?.user?.role ?? null);
        setUserId(data?.user?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        setRole(null);
        setUserId(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { role, userId, loading };
}