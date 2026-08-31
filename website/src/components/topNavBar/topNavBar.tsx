"use client";

import { Box, type LucideIcon, Settings, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./topNavBar.module.css";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { name: "Visualiser", href: "/visualiser", icon: Box },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Order", href: "/orders", icon: ShoppingBag },
];

export function TopNavBar() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <div className={styles.navContainer}>
        <nav className={styles.capsuleTrack} aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href === "/visualiser" && ["/", "/visualiser"].includes(pathname));
            const Icon = item.icon;

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

export default TopNavBar;
