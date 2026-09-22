"use client";

import {
  Box,
  Home,
  type LucideIcon,
  Settings,
  ShoppingBag,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./topNavBar.module.css";
import { useRole } from "@/lib/useRole";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  iconOnly?: boolean;
  staffOnly?: boolean;
}

const navItems: NavItem[] = [
  { name: "Portal", href: "/portal", icon: Home },
  { name: "Visualiser", href: "/visualiser", icon: Box, staffOnly: true },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Order", href: "/orders", icon: ShoppingBag },
  { name: "Account", href: "/account", icon: User, iconOnly: true },
];

export function TopNavBar() {
  const pathname = usePathname();
  const { role } = useRole();

  // Staff-only items stay visible for everyone EXCEPT confirmed customers,
  // so the team/supervisor navigation is unchanged (no load flicker).
  const items = navItems.filter(
    (item) => !item.staffOnly || role !== "customer",
  );

  return (
    <header className={styles.header}>
      <div className={styles.navContainer}>
        <nav className={styles.capsuleTrack} aria-label="Main Navigation">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.name}
                title={item.name}
                className={`${styles.navButton} ${item.iconOnly ? styles.iconOnlyButton : ""} ${
                  isActive ? styles.navButtonActive : ""
                }`}
              >
                {isActive && <div className={styles.activeLiquidPill} />}
                <span className={styles.iconWrapper}>
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                </span>
                {!item.iconOnly && <span className={styles.navLabel}>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default TopNavBar;
