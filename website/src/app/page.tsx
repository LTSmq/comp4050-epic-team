import Link from "next/link";
import { getAuthUser } from "@/lib/auth";

import styles from "./page.module.css";

export default async function Home() {
  const user = await getAuthUser();

  return (
    <main className={styles.page}>
      {/* =========================
          NAVIGATION
          ========================= */}

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
          <Link href={user ? "/portal" : "/login"}>
            Portal
          </Link>

          <Link href={user ? "/order" : "/login"}>
            Order
          </Link>

          <Link href="/visualiser">
            Visualiser
          </Link>

          {user ? (
            <Link
              href="/account"
              className={styles.signInButton}
            >
              {user.username}
            </Link>
          ) : (
            <Link
              href="/login"
              className={styles.signInButton}
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* =========================
          HERO
          ========================= */}

      <section className={styles.hero}>
        <div className={styles.heroGlow} />

        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>
            <span className={styles.liveDot} />
            PERFECT FIT
          </div>

          <h1 className={styles.heroTitle}>
            Warehouse
            <br />
            packing,
            <span>
              intelligently
              <br />
              connected.
            </span>
          </h1>

          <p className={styles.heroDescription}>
            Access warehouse orders, review packing
            information and view optimised packing
            results through the Perfect Fit workspace.
          </p>

          <div className={styles.heroActions}>
            <Link
              href={user ? "/portal" : "/login"}
              className={styles.primaryButton}
            >
              {user
                ? "Open portal"
                : "Access portal"}

              <span className={styles.buttonArrow}>
                →
              </span>
            </Link>

            <Link
              href={user ? "/order" : "/login"}
              className={styles.secondaryButton}
            >
              View orders
            </Link>
          </div>

          {user && (
            <div className={styles.heroMeta}>
              <div>
                <span className={styles.metaLabel}>
                  SIGNED IN AS
                </span>

                <strong>{user.username}</strong>
              </div>

              <div>
                <span className={styles.metaLabel}>
                  WORKSPACE
                </span>

                <strong>Perfect Fit Portal</strong>
              </div>
            </div>
          )}
        </div>

        {/* =========================
            SYSTEM PANEL
            ========================= */}

        <div className={styles.systemPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>
                PERFECT FIT
              </span>

              <h2>Workspace overview</h2>
            </div>

            <div className={styles.onlineBadge}>
              <span />
              READY
            </div>
          </div>

          <div className={styles.flowDiagram}>
            <div
              className={`${styles.flowNode} ${styles.activeNode}`}
            >
              <div className={styles.nodeIcon}>
                01
              </div>

              <div>
                <span>PORTAL</span>
                <strong>Workspace access</strong>
              </div>
            </div>

            <div className={styles.flowLine}>
              <span />
            </div>

            <div className={styles.flowNode}>
              <div className={styles.nodeIcon}>
                02
              </div>

              <div>
                <span>ORDER</span>
                <strong>Review order data</strong>
              </div>
            </div>

            <div className={styles.flowLine}>
              <span />
            </div>

            <div className={styles.flowNode}>
              <div className={styles.nodeIcon}>
                03
              </div>

              <div>
                <span>PACKING</span>
                <strong>Optimisation</strong>
              </div>
            </div>

            <div className={styles.flowLine}>
              <span />
            </div>

            <div className={styles.flowNode}>
              <div className={styles.nodeIcon}>
                04
              </div>

              <div>
                <span>RESULT</span>
                <strong>Visualisation</strong>
              </div>
            </div>
          </div>

          <div className={styles.dataPreview}>
            <div
              className={styles.dataPreviewHeader}
            >
              <span>ORDER STATUS</span>

              <span className={styles.jsonBadge}>
                LIVE
              </span>
            </div>

            <pre>{`{
  "orderID": 22,
  "status": "ready",
  "packing": "available"
}`}</pre>
          </div>
        </div>
      </section>

      {/* =========================
          QUICK ACCESS
          ========================= */}

      <section className={styles.quickActions}>
        <div className={styles.quickActionText}>
          <span>QUICK ACCESS</span>

          <h2>Get where you need to go.</h2>
        </div>

        <div className={styles.actionCards}>
          <Link
            href={user ? "/portal" : "/login"}
            className={styles.actionCard}
          >
            <div className={styles.actionIcon}>
              ↗
            </div>

            <div>
              <h3>Portal</h3>

              <p>
                Open your Perfect Fit workspace and
                access your day-to-day tools.
              </p>
            </div>

            <span className={styles.cardArrow}>
              ↗
            </span>
          </Link>

          <Link
            href={user ? "/order" : "/login"}
            className={styles.actionCard}
          >
            <div className={styles.actionIcon}>
              ≡
            </div>

            <div>
              <h3>Orders</h3>

              <p>
                Review available orders, boxes and
                item information.
              </p>
            </div>

            <span className={styles.cardArrow}>
              ↗
            </span>
          </Link>

          <Link
            href="/visualiser"
            className={styles.actionCard}
          >
            <div className={styles.actionIcon}>
              ◇
            </div>

            <div>
              <h3>Visualiser</h3>

              <p>
                Open available packing layouts and
                inspect packing results.
              </p>
            </div>

            <span className={styles.cardArrow}>
              ↗
            </span>
          </Link>
        </div>
      </section>

      {/* =========================
          OVERVIEW
          ========================= */}

      <section className={styles.workflowSection}>
        <div className={styles.sectionIntro}>
          <div>
            <span
              className={styles.sectionEyebrow}
            >
              WORKSPACE
            </span>

            <h2>
              From order data to packing results.
            </h2>
          </div>

          <p>
            Access existing warehouse orders,
            review their information and view the
            resulting packing layout when it
            becomes available.
          </p>
        </div>

        <div className={styles.workflowGrid}>
          <div className={styles.workflowCard}>
            <div className={styles.workflowTop}>
              <span
                className={styles.stepNumber}
              >
                01
              </span>

              <span
                className={styles.stepLine}
              />
            </div>

            <h3>Access</h3>

            <p>
              Enter your Perfect Fit workspace
              through the portal.
            </p>
          </div>

          <div className={styles.workflowCard}>
            <div className={styles.workflowTop}>
              <span
                className={styles.stepNumber}
              >
                02
              </span>

              <span
                className={styles.stepLine}
              />
            </div>

            <h3>Review</h3>

            <p>
              Select an available order and review
              its boxes and item information.
            </p>
          </div>

          <div className={styles.workflowCard}>
            <div className={styles.workflowTop}>
              <span
                className={styles.stepNumber}
              >
                03
              </span>

              <span
                className={styles.stepLine}
              />
            </div>

            <h3>Process</h3>

            <p>
              Packing information is processed to
              produce an optimised result.
            </p>
          </div>

          <div className={styles.workflowCard}>
            <div className={styles.workflowTop}>
              <span
                className={styles.stepNumber}
              >
                04
              </span>

              <span
                className={styles.stepLine}
              />
            </div>

            <h3>View</h3>

            <p>
              Open the visualiser to inspect the
              completed packing layout.
            </p>
          </div>
        </div>
      </section>

      {/* =========================
          FEATURES
          ========================= */}

      <section
        className={styles.capabilitySection}
      >
        <div
          className={styles.capabilityHeader}
        >
          <span
            className={styles.sectionEyebrow}
          >
            PERFECT FIT
          </span>

          <h2>
            Your warehouse tools,
            connected.
          </h2>
        </div>

        <div className={styles.capabilityGrid}>
          <div
            className={styles.capabilityCard}
          >
            <span
              className={styles.capabilityTag}
            >
              PORTAL
            </span>

            <h3>Central workspace</h3>

            <p>
              Access orders, results and account
              tools from your main workspace.
            </p>

            <div
              className={
                styles.capabilityCorner
              }
            />
          </div>

          <div
            className={styles.capabilityCard}
          >
            <span
              className={styles.capabilityTag}
            >
              ORDERS
            </span>

            <h3>Order information</h3>

            <p>
              Review existing warehouse orders,
              boxes and their associated items.
            </p>

            <div
              className={
                styles.capabilityCorner
              }
            />
          </div>

          <div
            className={styles.capabilityCard}
          >
            <span
              className={styles.capabilityTag}
            >
              RESULTS
            </span>

            <h3>Packing layouts</h3>

            <p>
              Access completed packing results
              through the visualiser.
            </p>

            <div
              className={
                styles.capabilityCorner
              }
            />
          </div>
        </div>
      </section>

      {/* =========================
          FOOTER
          ========================= */}

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
            {user
              ? `Signed in as ${user.username}`
              : "Ready"}
          </span>
        </div>
      </footer>
    </main>
  );
}