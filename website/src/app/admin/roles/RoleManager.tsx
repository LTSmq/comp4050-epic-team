"use client";

import { useEffect, useState } from "react";
import styles from "./RoleManager.module.css";

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
    const id = setTimeout(() => void loadUsers(), 0);
    return () => clearTimeout(id);
  }, []);

  async function changeRole(userId: string, role: Role) {
    setError("");
    setSuccess("");
    setSavingId(userId);

    try {
      const response = await fetch(
        `/api/users/${encodeURIComponent(userId)}/role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update role.");
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, role } : user,
        ),
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
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>Access control</div>

          <h1>
            Role <span>management.</span>
          </h1>

          <p>
            Assign customer, team or supervisor roles.
          </p>
        </header>

        {error && (
          <div className={`${styles.message} ${styles.error}`}>{error}</div>
        )}

        {success && (
          <div className={`${styles.message} ${styles.success}`}>
            {success}
          </div>
        )}

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.sectionLabel}>Users</p>
              <h2>Role assignments</h2>
            </div>

            <div className={styles.userCount}>{users.length}</div>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading users...</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th className={styles.emailColumn}>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={
                        user.id === currentUserId ? styles.currentRow : undefined
                      }
                    >
                      <td className={styles.username}>{user.username}</td>

                      <td className={`${styles.email} ${styles.emailColumn}`}>
                        {user.email}
                      </td>

                      <td>
                        <div className={styles.roleCell}>
                          <select
                            className={styles.select}
                            value={user.role}
                            disabled={
                              savingId === user.id ||
                              user.id === currentUserId
                            }
                            onChange={(event) =>
                              changeRole(
                                user.id,
                                event.target.value as Role,
                              )
                            }
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>

                          {user.id === currentUserId && (
                            <span className={styles.you}>(you)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
