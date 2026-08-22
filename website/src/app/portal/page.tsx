import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth";

import styles from "./portal.module.css";

async function logout() {
  "use server";

  const cookieStore = await cookies();

  cookieStore.delete("auth_token");

  redirect("/");
}

export default async function PortalPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

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
          <Link href="/order">
            Order
          </Link>

          <Link href="/visualiser">
            Visualiser
          </Link>

          <span>
            {user.username}
          </span>

          <form action={logout}>
            <button
              type="submit"
              className={styles.signOutButton}
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <section className={styles.portalHeader}>
        <div>
          <div className={styles.eyebrow}>
            <span className={styles.liveDot} />
            PERFECT FIT
          </div>

          <h1>
            Warehouse management,
            <span> made simpler.</span>
          </h1>

          <p>
            Create packing requests, review your
            orders and access available packing
            results from one place.
          </p>
        </div>

        <div className={styles.statusPanel}>
          <div>
            <span className={styles.statusLabel}>
              PORTAL STATUS
            </span>

            <strong>Connected</strong>
          </div>

          <span className={styles.readyBadge}>
            <span />
            READY
          </span>
        </div>
      </section>

      <section className={styles.mainGrid}>
        <div className={styles.actionsArea}>
          <div className={styles.sectionHeading}>
            <span>QUICK ACTIONS</span>

            <h2>
              What would you like to do?
            </h2>
          </div>

          <div className={styles.actionGrid}>
            <Link
              href="/order"
              className={styles.actionCard}
            >
              <div className={styles.cardTop}>
                <div
                  className={styles.actionNumber}
                >
                  01
                </div>

                <span
                  className={styles.cardArrow}
                >
                  ↗
                </span>
              </div>

              <div className={styles.cardContent}>
                <span
                  className={styles.cardLabel}
                >
                  ORDER
                </span>

                <h3>
                  New packing request
                </h3>

                <p>
                  Create and submit a new packing
                  request with the required order
                  and item information.
                </p>
              </div>
            </Link>

            <Link
              href="/orders"
              className={styles.actionCard}
            >
              <div className={styles.cardTop}>
                <div
                  className={styles.actionNumber}
                >
                  02
                </div>

                <span
                  className={styles.cardArrow}
                >
                  ↗
                </span>
              </div>

              <div className={styles.cardContent}>
                <span
                  className={styles.cardLabel}
                >
                  REQUESTS
                </span>

                <h3>
                  View requests
                </h3>

                <p>
                  Review submitted packing
                  requests and check their latest
                  status.
                </p>
              </div>
            </Link>

            <Link
              href="/visualiser"
              className={styles.actionCard}
            >
              <div className={styles.cardTop}>
                <div
                  className={styles.actionNumber}
                >
                  03
                </div>

                <span
                  className={styles.cardArrow}
                >
                  ↗
                </span>
              </div>

              <div className={styles.cardContent}>
                <span
                  className={styles.cardLabel}
                >
                  RESULTS
                </span>

                <h3>
                  Open visualiser
                </h3>

                <p>
                  View available packing results
                  and inspect completed layouts.
                </p>
              </div>
            </Link>
          </div>
        </div>

        <aside className={styles.workflowPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>
                QUICK OVERVIEW
              </span>

              <h2>
                Your workspace
              </h2>
            </div>

            <span
              className={styles.systemBadge}
            >
              READY
            </span>
          </div>

          <div className={styles.workflow}>
            <div
              className={`${styles.workflowNode} ${styles.activeNode}`}
            >
              <div
                className={styles.nodeNumber}
              >
                01
              </div>

              <div>
                <span>
                  ORDERS
                </span>

                <strong>
                  Create
                </strong>

                <small>
                  Start a new packing request
                </small>
              </div>
            </div>

            <div className={styles.flowLine}>
              <span />
            </div>

            <div
              className={styles.workflowNode}
            >
              <div
                className={styles.nodeNumber}
              >
                02
              </div>

              <div>
                <span>
                  REQUESTS
                </span>

                <strong>
                  Review
                </strong>

                <small>
                  Check submitted orders
                </small>
              </div>
            </div>

            <div className={styles.flowLine}>
              <span />
            </div>

            <div
              className={styles.workflowNode}
            >
              <div
                className={styles.nodeNumber}
              >
                03
              </div>

              <div>
                <span>
                  RESULTS
                </span>

                <strong>
                  View
                </strong>

                <small>
                  Open available packing layouts
                </small>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.infoSection}>
        <div className={styles.infoIntro}>
          <span>
            YOUR WORKSPACE
          </span>

          <h2>
            Everything you need,
            <br />
            within reach.
          </h2>

          <p>
            Move between your everyday packing
            tasks without having to leave the
            portal.
          </p>
        </div>

        <div className={styles.infoGrid}>
          <article>
            <span>
              01 / CREATE
            </span>

            <h3>
              Start an order
            </h3>

            <p>
              Enter the order and item details
              required for a new packing request.
            </p>
          </article>

          <article>
            <span>
              02 / REVIEW
            </span>

            <h3>
              Check requests
            </h3>

            <p>
              Keep track of submitted orders and
              quickly return to previous requests.
            </p>
          </article>

          <article>
            <span>
              03 / VIEW
            </span>

            <h3>
              See results
            </h3>

            <p>
              Open available packing results and
              inspect the completed layout.
            </p>
          </article>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <strong>
            THOMAX .WMS
          </strong>

          <span>
            Perfect Fit
          </span>
        </div>

        <div className={styles.footerRight}>
          <span
            className={styles.footerDot}
          >
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