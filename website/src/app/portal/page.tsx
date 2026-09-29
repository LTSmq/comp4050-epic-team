import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import { getAuthUser } from "@/lib/auth";
import TopNavBar from "@/components/topNavBar/topNavBar";

import styles from "./portal.module.css";

const QUICK_ACTIONS = [
  {
    num: "01",
    label: "ORDER",
    title: "New packing request",
    desc: "Create and submit a new packing request with the required order and item information.",
    href: "/orders",
  },
  {
    num: "02",
    label: "REQUESTS",
    title: "View requests",
    desc: "Review submitted packing requests and check their latest status.",
    href: "/orders",
  },
  {
    num: "03",
    label: "RESULTS",
    title: "Open visualiser",
    desc: "View available packing results and inspect completed layouts.",
    href: "/visualiser",
  },
];

const WORKFLOW_STEPS = [
  {
    num: "01",
    tag: "ORDERS",
    title: "Create",
    desc: "Start a new packing request",
    active: true,
  },
  {
    num: "02",
    tag: "REQUESTS",
    title: "Review",
    desc: "Check submitted orders",
    active: false,
  },
  {
    num: "03",
    tag: "RESULTS",
    title: "View",
    desc: "Open available packing layouts",
    active: false,
  },
];

const INFO_ITEMS = [
  {
    tag: "01 / CREATE",
    title: "Start an order",
    desc: "Enter the order and item details required for a new packing request.",
  },
  {
    tag: "02 / REVIEW",
    title: "Check requests",
    desc: "Keep track of submitted orders and quickly return to previous requests.",
  },
  {
    tag: "03 / VIEW",
    title: "See results",
    desc: "Open available packing results and inspect the completed layout.",
  },
];

export default async function PortalPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className={styles.page}>
      <TopNavBar />

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
            Create packing requests, review your orders and access available packing
            results from one place.
          </p>
        </div>

        <div className={styles.statusPanel}>
          <div>
            <span className={styles.statusLabel}>PORTAL STATUS</span>
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
            <h2>What would you like to do?</h2>
          </div>

          <div className={styles.actionGrid}>
            {QUICK_ACTIONS.map(({ num, label, title, desc, href }) => (
              <Link key={num} href={href} className={styles.actionCard}>
                <div className={styles.cardTop}>
                  <div className={styles.actionNumber}>{num}</div>
                  <span className={styles.cardArrow}>↗</span>
                </div>

                <div className={styles.cardContent}>
                  <span className={styles.cardLabel}>{label}</span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <aside className={styles.workflowPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>QUICK OVERVIEW</span>
              <h2>Your workspace</h2>
            </div>

            <span className={styles.systemBadge}>READY</span>
          </div>

          <div className={styles.workflow}>
            {WORKFLOW_STEPS.map((step, index) => (
              <Fragment key={step.num}>
                {index > 0 && (
                  <div className={styles.flowLine}>
                    <span />
                  </div>
                )}
                <div
                  className={`${styles.workflowNode} ${step.active ? styles.activeNode : ""}`}
                >
                  <div className={styles.nodeNumber}>{step.num}</div>

                  <div>
                    <span>{step.tag}</span>
                    <strong>{step.title}</strong>
                    <small>{step.desc}</small>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </aside>
      </section>

      <section className={styles.infoSection}>
        <div className={styles.infoIntro}>
          <span>YOUR WORKSPACE</span>

          <h2>
            Everything you need,
            <br />
            within reach.
          </h2>

          <p>
            Move between your everyday packing tasks without having to leave the portal.
          </p>
        </div>

        <div className={styles.infoGrid}>
          {INFO_ITEMS.map((item) => (
            <article key={item.tag}>
              <span>{item.tag}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}