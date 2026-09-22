"use client";

import { useEffect, useState } from "react";

type Role = "customer" | "team" | "supervisor";

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: Role;
};

const ROLES: Role[] = ["customer", "team", "supervisor"];

type RoleManagerProps = {
  currentUserId: string;
};

export default function RoleManager({ currentUserId }: RoleManagerProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadUsers() {
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load users.");
      }
      const data = await response.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (loadError) {
      console.error("Failed to load users:", loadError);
      setError("Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function changeRole(userId: string, role: Role) {
    setError("");
    setSuccess("");
    setSavingId(userId);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update role.");
      }

      setUsers((current) =>
        current.map((u) => (u.id === userId ? { ...u, role } : u)),
      );
      setSuccess(`Role updated to ${role}.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update role.",
      );
    } finally {
      setSavingId("");
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px" }}>
      <h1 style={{ marginBottom: 6 }}>Role management</h1>
      <p style={{ opacity: 0.7, marginBottom: 24 }}>
        Assign customer, team or supervisor roles. Changes take effect next
        time the user logs in.
      </p>

      {error && (
        <div style={{ color: "#982c2c", marginBottom: 12 }}>{error}</div>
      )}
      {success && (
        <div style={{ color: "#216f40", marginBottom: 12 }}>{success}</div>
      )}

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "10px 8px" }}>User</th>
              <th style={{ padding: "10px 8px" }}>Email</th>
              <th style={{ padding: "10px 8px" }}>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "10px 8px" }}>{u.username}</td>
                <td style={{ padding: "10px 8px", opacity: 0.7 }}>{u.email}</td>
                <td style={{ padding: "10px 8px" }}>
                  <select
                    value={u.role}
                    disabled={savingId === u.id || u.id === currentUserId}
                    onChange={(event) =>
                      changeRole(u.id, event.target.value as Role)
                    }
                    style={{ padding: "4px 8px" }}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  {u.id === currentUserId && (
                    <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>
                      (you)
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}