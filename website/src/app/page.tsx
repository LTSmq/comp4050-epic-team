import Link from "next/link";
import styles from "./page.module.css";

const workflow = [
  {
    number: "01",
    title: "Create request",
    description:
      "Enter the order and item information required for the packing request.",
  },
  {
    number: "02",
    title: "Submit",
    description:
      "The Portal validates the request and prepares it for optimisation.",
  },
  {
    number: "03",
    title: "Optimise",
    description:
      "The packing request is processed through the Perfect Fit optimisation workflow.",
  },
  {
    number: "04",
    title: "Visualise",
    description:
      "Review the completed packing solution through the visualisation interface.",
  },
];

const capabilities = [
  {
    title: "Order Management",
    description:
      "Create, submit and review packing requests through one central interface.",
    tag: "PORTAL",
  },
  {
    title: "Secure Access",
    description:
      "Authenticated user access with registered accounts and protected Portal functionality.",
    tag: "ACCESS",
  },
  {
    title: "Integrated Workflow",
    description:
      "A central connection point between users, optimisation services and visualisation.",
    tag: "INTEGRATION",
  },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      {/* Navigation */}
      <header className={styles.navbar}>
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

        <nav className={styles.navLinks}>
          <Link href="/orders">Order</Link>
          <Link href="/visualiser">Visualiser</Link>
          <Link href="/login" className={styles.signInButton}>
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroGlow} />

          <div className={styles.heroContent}>
            <div className={styles.eyebrow}>
              <span className={styles.liveDot} />
              PROJECT PERFECT FIT
            </div>

            <h1 className={styles.heroTitle}>
              Warehouse packing,
              <span> intelligently connected.</span>
            </h1>

            <p className={styles.heroDescription}>
              A central portal for submitting packing requests, tracking their
              progress and accessing optimised packing solutions within the
              Perfect Fit workflow.
            </p>

            <div className={styles.heroActions}>
              <Link href="/order" className={styles.primaryButton}>
                <span>New packing request</span>
                <span className={styles.buttonArrow}>→</span>
              </Link>

              <Link href="/orders" className={styles.secondaryButton}>
                View orders
              </Link>
            </div>

            <div className={styles.heroMeta}>
              <div>
                <span className={styles.metaLabel}>PLATFORM</span>
                <strong>Thomax .wms</strong>
              </div>

              <div>
                <span className={styles.metaLabel}>PROJECT</span>
                <strong>Perfect Fit</strong>
              </div>

              <div>
                <span className={styles.metaLabel}>LOCATION</span>
                <strong>Sydney, Australia</strong>
              </div>
            </div>
          </div>

          {/* Right-side system panel */}
          <div className={styles.systemPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>SYSTEM WORKFLOW</span>
                <h2>Perfect Fit Portal</h2>
              </div>

              <div className={styles.onlineBadge}>
                <span />
                READY
              </div>
            </div>

            <div className={styles.flowDiagram}>
              <div className={styles.flowNode}>
                <div className={styles.nodeIcon}>01</div>
                <div>
                  <span>INPUT</span>
                  <strong>Order Request</strong>
                </div>
              </div>

              <div className={styles.flowLine}>
                <span />
              </div>

              <div className={`${styles.flowNode} ${styles.activeNode}`}>
                <div className={styles.nodeIcon}>02</div>
                <div>
                  <span>ACCESS LAYER</span>
                  <strong>Epic Portal</strong>
                </div>
              </div>

              <div className={styles.flowLine}>
                <span />
              </div>

              <div className={styles.flowNode}>
                <div className={styles.nodeIcon}>03</div>
                <div>
                  <span>PROCESS</span>
                  <strong>Optimisation</strong>
                </div>
              </div>

              <div className={styles.flowLine}>
                <span />
              </div>

              <div className={styles.flowNode}>
                <div className={styles.nodeIcon}>04</div>
                <div>
                  <span>OUTPUT</span>
                  <strong>Visualisation</strong>
                </div>
              </div>
            </div>

            <div className={styles.dataPreview}>
              <div className={styles.dataPreviewHeader}>
                <span>REQUEST FORMAT</span>
                <span className={styles.jsonBadge}>JSON</span>
              </div>

              <pre>
{`{
  "orderReference": "ORD-1042",
  "destination": "Sydney",
  "status": "submitted"
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className={styles.quickActions}>
          <div className={styles.quickActionText}>
            <span>PORTAL ACCESS</span>
            <h2>What do you need to do?</h2>
          </div>

          <div className={styles.actionCards}>
            <Link href="/order" className={styles.actionCard}>
              <div className={styles.actionIcon}>+</div>

              <div>
                <h3>New order</h3>
                <p>Submit a new request for packing optimisation.</p>
              </div>

              <span className={styles.cardArrow}>↗</span>
            </Link>

            <Link href="/orders" className={styles.actionCard}>
              <div className={styles.actionIcon}>≡</div>

              <div>
                <h3>Order history</h3>
                <p>Review previously submitted packing requests.</p>
              </div>

              <span className={styles.cardArrow}>↗</span>
            </Link>

            <Link href="/visualiser" className={styles.actionCard}>
              <div className={styles.actionIcon}>◇</div>

              <div>
                <h3>Visualiser</h3>
                <p>Open the packing visualisation interface.</p>
              </div>

              <span className={styles.cardArrow}>↗</span>
            </Link>
          </div>
        </section>

        {/* Workflow */}
        <section className={styles.workflowSection}>
          <div className={styles.sectionIntro}>
            <div>
              <span className={styles.sectionEyebrow}>WORKFLOW</span>
              <h2>From request to packing solution.</h2>
            </div>

            <p>
              Perfect Fit connects the user-facing Portal with the wider packing
              workflow while keeping each stage clearly separated.
            </p>
          </div>

          <div className={styles.workflowGrid}>
            {workflow.map((step) => (
              <article className={styles.workflowCard} key={step.number}>
                <div className={styles.workflowTop}>
                  <span className={styles.stepNumber}>{step.number}</span>
                  <span className={styles.stepLine} />
                </div>

                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className={styles.capabilitySection}>
          <div className={styles.capabilityHeader}>
            <span className={styles.sectionEyebrow}>PORTAL CAPABILITIES</span>
            <h2>Built around warehouse operations.</h2>
          </div>

          <div className={styles.capabilityGrid}>
            {capabilities.map((capability) => (
              <article
                key={capability.title}
                className={styles.capabilityCard}
              >
                <span className={styles.capabilityTag}>{capability.tag}</span>

                <h3>{capability.title}</h3>

                <p>{capability.description}</p>

                <div className={styles.capabilityCorner} />
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <strong>PROJECT PERFECT FIT</strong>
          <span>Epic Fit · COMP4050</span>
        </div>

        <div className={styles.footerRight}>
          <span>Thomax .wms</span>
          <span className={styles.footerDot}>•</span>
          <span>Sydney, Australia</span>
        </div>
      </footer>
    </div>
  );
}