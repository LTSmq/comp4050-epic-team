import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import TopNavBar from "@/components/topNavBar/topNavBar";
import SignOutButton from "./SignOutButton";

import styles from "./account.module.css";

export default async function AccountPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const initial =
    user.username?.charAt(0).toUpperCase() || "U";

  return (
    <main className={styles.page}>
      <TopNavBar />

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

          <SignOutButton />
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
              <span>Role</span>
              <strong style={{ textTransform: "capitalize" }}>
                {user.role}
              </strong>
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
    </main>
  );
}
