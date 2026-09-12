"use client";

import { Suspense } from "react";
import {
  Box,
  Home,
  type LucideIcon,
  Settings,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./topNavBar.module.css";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { name: "Portal", href: "/portal", icon: Home },
  { name: "Visualiser", href: "/visualiser?tab=visualiser", icon: Box },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Order", href: "/visualiser?tab=orders", icon: ShoppingBag },
];

function TopNavBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "visualiser";

  return (
    <header className={styles.header}>
      <div className={styles.navContainer}>
        <nav className={styles.capsuleTrack} aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.name === "Visualiser"
                ? pathname === "/visualiser" && tab === "visualiser"
                : item.name === "Order"
                ? pathname === "/visualiser" && tab === "orders"
                : pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`${styles.navButton} ${isActive ? styles.navButtonActive : ""}`}
              >
                {isActive && <div className={styles.activeLiquidPill} />}
                <span className={styles.iconWrapper}>
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                </span>
                <span className={styles.navLabel}>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function TopNavBar() {
  return (
    <Suspense fallback={null}>
      <TopNavBarContent />
    </Suspense>
  );
}

export default TopNavBar;
