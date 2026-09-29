import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import TopNavBar from "@/components/topNavBar/topNavBar";
import portalStyles from "../portal/portal.module.css";

import styles from "./account.module.css";

interface IActionCard {
  num: string;
  label: string;
  title: string;
  desc: string;
  href: string;
}

interface IAccountDetail {
  label: string;
  value: string;
}

const ACCOUNT_QUICK_ACTIONS: IActionCard[] = [
  {
    num: "01",
    label: "PORTAL",
    title: "Open portal",
    desc: "Access your main Perfect Fit workspace.",
    href: "/portal",
  },
  {
    num: "02",
    label: "ORDERS",
    title: "View orders",
    desc: "Review available orders, boxes and item information.",
    href: "/orders",
  },
  {
    num: "03",
    label: "RESULTS",
    title: "Visualiser",
    desc: "Open available packing layouts and results.",
    href: "/visualiser",
  },
];

export default async function AccountPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const initial =
    user.username?.charAt(0).toUpperCase() || "U";

  const accountDetails: IAccountDetail[] = [
    { label: "Username", value: user.username },
    { label: "Email", value: user.email },
    { label: "Workspace", value: "Perfect Fit" },
    { label: "Session", value: "Signed in" },
  ];

  return (
    <main className={portalStyles.page}>
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
            {accountDetails.map((detail) => (
              <div key={detail.label} className={styles.detail}>
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.actionsSection}>
        <div className={styles.sectionIntro}>
          <span>QUICK ACCESS</span>

          <h2>Your workspace</h2>
        </div>

        <div className={portalStyles.actionGrid}>
          {ACCOUNT_QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={portalStyles.actionCard}
            >
              <div className={portalStyles.cardTop}>
                <span className={styles.actionTop}>{action.num}</span>
                <span className={portalStyles.cardArrow}>↗</span>
              </div>

              <div className={portalStyles.cardContent}>
                <span className={portalStyles.cardLabel}>
                  {action.label}
                </span>

                <h3>{action.title}</h3>

                <p>{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}