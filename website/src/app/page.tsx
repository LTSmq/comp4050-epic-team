import Link from "next/link";
import styles from "./page.module.css";

// The dashboard menu. To add or rename a tile later, just edit this list.
const actions = [
  { href: "/order",    label: "New order",      desc: "Enter items and containers, then pack them into the fewest cartons." },
  { href: "/orders",   label: "Order history",  desc: "Review past orders and open their packing results." },
  { href: "/register", label: "Create account", desc: "Set up access for a new operator." },
  { href: "/login",    label: "Sign in",        desc: "Return to your saved orders." },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Perfect Fit · Portal</span>
          <h1 className={styles.title}>Pack the order into the fewest boxes.</h1>
          <p className={styles.lede}>
            Enter what needs to ship and system works out which cartons to use
            and how to load them.
          </p>
        </header>

        <nav className={styles.grid}>
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className={styles.card}>
              <span className={styles.cardLabel}>{a.label}</span>
              <span className={styles.cardDesc}>{a.desc}</span>
              <span className={styles.cardArrow} aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}