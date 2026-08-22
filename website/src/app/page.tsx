import Link from "next/link";
import { getAuthUser } from "@/lib/auth";

import styles from "./page.module.css";

export default async function Home() {
  const user = await getAuthUser();

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
          <Link href={user ? "/order" : "/login"}>
            Order
          </Link>

          <Link href="/visualiser">
            Visualiser
          </Link>

          {user ? (
            <Link
              href="/portal"
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
            Submit packing requests, keep track of
            orders and access optimised packing
            results from one place.
          </p>

          <div className={styles.heroActions}>
            <Link
              href={user ? "/order" : "/login"}
              className={styles.primaryButton}
            >
              New packing request

              <span className={styles.buttonArrow}>
                →
              </span>
            </Link>

            <Link
              href={user ? "/orders" : "/login"}
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

                <strong>
                  {user.username}
                </strong>
              </div>

              <div>
                <span className={styles.metaLabel}>
                  WORKSPACE
                </span>

                <strong>
                  Perfect Fit Portal
                </strong>
              </div>
            </div>
          )}
        </div>

        <div className={styles.systemPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>
                WORKSPACE
              </span>

              <h2>
                Perfect Fit
              </h2>
            </div>

            <div className={styles.onlineBadge}>
              <span />
              READY
            </div>
          </div>

          <div className={styles.flowDiagram}>
            <div className={styles.flowNode}>
              <div className={styles.nodeIcon}>
                01
              </div>

              <div>
                <span>
                  ORDER
                </span>

                <strong>
                  Packing request
                </strong>
              </div>
            </div>

            <div className={styles.flowLine}>
              <span />
            </div>

            <div
              className={`${styles.flowNode} ${styles.activeNode}`}
            >
              <div className={styles.nodeIcon}>
                02
              </div>

              <div>
                <span>
                  PORTAL
                </span>

                <strong>
                  Request submitted
                </strong>
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
                <span>
                  PACKING
                </span>

                <strong>
                  Optimisation
                </strong>
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
                <span>
                  RESULT
                </span>

                <strong>
                  Visualisation
                </strong>
              </div>
            </div>
          </div>

          <div className={styles.dataPreview}>
            <div className={styles.dataPreviewHeader}>
              <span>
                REQUEST FORMAT
              </span>

              <span className={styles.jsonBadge}>
                JSON
              </span>
            </div>

            <pre>{`{
  "orderReference": "ORD-1042",
  "destination": "Sydney",
  "status": "submitted"
}`}</pre>
          </div>
        </div>
      </section>

      <section className={styles.quickActions}>
        <div className={styles.quickActionText}>
          <span>
            QUICK ACCESS
          </span>

          <h2>
            Get where you need to go.
          </h2>
        </div>

        <div className={styles.actionCards}>
          <Link
            href={user ? "/order" : "/login"}
            className={styles.actionCard}
          >
            <div className={styles.actionIcon}>
              +
            </div>

            <div>
              <h3>
                Create order
              </h3>

              <p>
                Enter order and item details for a
                new packing request.
              </p>
            </div>

            <span className={styles.cardArrow}>
              ↗
            </span>
          </Link>

          <Link
            href={user ? "/orders" : "/login"}
            className={styles.actionCard}
          >
            <div className={styles.actionIcon}>
              ≡
            </div>

            <div>
              <h3>
                View orders
              </h3>

              <p>
                Review submitted requests and their
                latest status.
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
              <h3>
                Visualiser
              </h3>

              <p>
                Open available packing layouts and
                results.
              </p>
            </div>

            <span className={styles.cardArrow}>
              ↗
            </span>
          </Link>
        </div>
      </section>

      <section className={styles.workflowSection}>
        <div className={styles.sectionIntro}>
          <div>
            <span className={styles.sectionEyebrow}>
              SIMPLE WORKFLOW
            </span>

            <h2>
              From request to packing result.
            </h2>
          </div>

          <p>
            Create an order, check its progress and
            open the finished packing layout when
            it becomes available.
          </p>
        </div>

        <div className={styles.workflowGrid}>
          <div className={styles.workflowCard}>
            <div className={styles.workflowTop}>
              <span className={styles.stepNumber}>
                01
              </span>

              <span className={styles.stepLine} />
            </div>

            <h3>
              Create
            </h3>

            <p>
              Enter the order information and items
              that need to be packed.
            </p>
          </div>

          <div className={styles.workflowCard}>
            <div className={styles.workflowTop}>
              <span className={styles.stepNumber}>
                02
              </span>

              <span className={styles.stepLine} />
            </div>

            <h3>
              Submit
            </h3>

            <p>
              Send the packing request for
              processing.
            </p>
          </div>

          <div className={styles.workflowCard}>
            <div className={styles.workflowTop}>
              <span className={styles.stepNumber}>
                03
              </span>

              <span className={styles.stepLine} />
            </div>

            <h3>
              Track
            </h3>

            <p>
              Check your submitted orders and their
              current status.
            </p>
          </div>

          <div className={styles.workflowCard}>
            <div className={styles.workflowTop}>
              <span className={styles.stepNumber}>
                04
              </span>

              <span className={styles.stepLine} />
            </div>

            <h3>
              View
            </h3>

            <p>
              Open the completed packing layout
              when the result is ready.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.capabilitySection}>
        <div className={styles.capabilityHeader}>
          <span className={styles.sectionEyebrow}>
            PERFECT FIT
          </span>

          <h2>
            Everything in one workspace.
          </h2>
        </div>

        <div className={styles.capabilityGrid}>
          <div className={styles.capabilityCard}>
            <span className={styles.capabilityTag}>
              ORDERS
            </span>

            <h3>
              Packing requests
            </h3>

            <p>
              Create structured packing requests
              containing order, location and item
              information.
            </p>

            <div className={styles.capabilityCorner} />
          </div>

          <div className={styles.capabilityCard}>
            <span className={styles.capabilityTag}>
              STATUS
            </span>

            <h3>
              Order tracking
            </h3>

            <p>
              Return to submitted requests and
              quickly check their latest status.
            </p>

            <div className={styles.capabilityCorner} />
          </div>

          <div className={styles.capabilityCard}>
            <span className={styles.capabilityTag}>
              RESULTS
            </span>

            <h3>
              Packing layouts
            </h3>

            <p>
              Access completed packing results
              through the visualiser.
            </p>

            <div className={styles.capabilityCorner} />
          </div>
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