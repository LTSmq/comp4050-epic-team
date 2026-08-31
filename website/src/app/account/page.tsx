import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth";

import styles from "./account.module.css";

async function logout() {
  "use server";

  const cookieStore = await cookies();

  cookieStore.delete("auth_token");

  redirect("/");
}

export default async function AccountPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const initial =
    user.username?.charAt(0).toUpperCase() || "U";

  return (
    <main className={styles.page}>
      <nav className={styles.navbar}>
        <Link href="/" className={styles.brand}>
          <div className={styles.brandMark}>
            <span />
            <span />
            <span />
          </div>

          <div className={styles.brandText}>
            <strong>THOMAX</strong>
            <span>.wms · Perfect Fit</span>
          </div>
        </Link>

        <div className={styles.navLinks}>
          <Link href="/orders">
            Order
          </Link>

          <Link href="/visualiser">
            Visualiser
          </Link>

          <Link
            href="/portal"
            className={styles.portalButton}
          >
            Portal
          </Link>
        </div>
      </nav>

      <section className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            <span className={styles.liveDot} />
            ACCOUNT
          </div>

          <h1>
            Your account,
            <span> in one place.</span>
          </h1>

          <p>
            View your account details and access
            your Perfect Fit workspace.
          </p>
        </div>

        <Link
          href="/"
          className={styles.backButton}
        >
          ← Dashboard
        </Link>
      </section>

      <section className={styles.accountLayout}>
        <div className={styles.profileCard}>
          <div className={styles.profileTop}>
            <div className={styles.avatar}>
              {initial}
            </div>

            <div>
              <span className={styles.profileLabel}>
                SIGNED IN AS
              </span>

              <h2>{user.username}</h2>

              <p>{user.email}</p>
            </div>
          </div>

          <div className={styles.statusRow}>
            <div>
              <span className={styles.statusLabel}>
                ACCOUNT STATUS
              </span>

              <strong>Active</strong>
            </div>

            <div className={styles.activeBadge}>
              <span />
              CONNECTED
            </div>
          </div>
        </div>

        <div className={styles.detailsCard}>
          <div className={styles.cardHeader}>
            <div>
              <span>ACCOUNT DETAILS</span>
              <h2>Profile</h2>
            </div>

            <span className={styles.cardNumber}>
              01
            </span>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detail}>
              <span>Username</span>
              <strong>{user.username}</strong>
            </div>

            <div className={styles.detail}>
              <span>Email</span>
              <strong>{user.email}</strong>
            </div>

            <div className={styles.detail}>
              <span>Workspace</span>
              <strong>Perfect Fit</strong>
            </div>

            <div className={styles.detail}>
              <span>Session</span>
              <strong>Signed in</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.actionsSection}>
        <div className={styles.sectionIntro}>
          <span>QUICK ACCESS</span>

          <h2>Your workspace</h2>
        </div>

        <div className={styles.actionGrid}>
          <Link
            href="/portal"
            className={styles.actionCard}
          >
            <div className={styles.actionTop}>
              <span>01</span>
              <span>↗</span>
            </div>

            <div>
              <span className={styles.actionLabel}>
                PORTAL
              </span>

              <h3>Open portal</h3>

              <p>
                Access your main Perfect Fit
                workspace.
              </p>
            </div>
          </Link>

          <Link
            href="/orders"
            className={styles.actionCard}
          >
            <div className={styles.actionTop}>
              <span>02</span>
              <span>↗</span>
            </div>

            <div>
              <span className={styles.actionLabel}>
                ORDERS
              </span>

              <h3>View orders</h3>

              <p>
                Review available orders, boxes and
                item information.
              </p>
            </div>
          </Link>

          <Link
            href="/visualiser"
            className={styles.actionCard}
          >
            <div className={styles.actionTop}>
              <span>03</span>
              <span>↗</span>
            </div>

            <div>
              <span className={styles.actionLabel}>
                RESULTS
              </span>

              <h3>Visualiser</h3>

              <p>
                Open available packing layouts and
                results.
              </p>
            </div>
          </Link>
        </div>
      </section>

      <section className={styles.sessionSection}>
        <div>
          <span className={styles.sessionLabel}>
            SESSION
          </span>

          <h2>Sign out</h2>

          <p>
            End your current Perfect Fit session.
          </p>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className={styles.signOutButton}
          >
            Sign out
            <span>→</span>
          </button>
        </form>
      </section>

      <footer className={styles.footer}>
        <div>
          <strong>THOMAX .WMS</strong>
          <span>Perfect Fit</span>
        </div>

        <div className={styles.footerRight}>
          <span className={styles.footerDot}>
            ●
          </span>

          <span>
            Signed in as {user.username}
          </span>
        </div>
      </footer>
    </main>
  );
}