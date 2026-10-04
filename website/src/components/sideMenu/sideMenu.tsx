"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import styles from "./sideMenu.module.css";

interface sideMenuProps{
    title?: string;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    collapsedContent?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
    ariaLabel?: string;
}

/*Generic collapsible side menu.
Acts as a reusable container which passes expanded content
as 'children', option compact symbols as 'collapsedContent' and
optional 'footer' controls.

It owns its open/collapsed state, unless conrtolled by 'open'/'onOenChange', so
any feature can be slotted in without the menu needing to know
what it holds.
*/

export function SideMenu({
    title,
    open,
    defaultOpen = false,
    onOpenChange,
    collapsedContent,
    footer,
    children,
    ariaLabel = "Side menu",
}: sideMenuProps) {
    const isControlled = open !== undefined;
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = isControlled ? open : internalOpen;

    function toggle() {
        const next = !isOpen;
        if (!isControlled)
            setInternalOpen(next);
        onOpenChange?.(next);
    }

    return(
        <aside
          className={`${styles.sideMenu} ${isOpen ? styles.open : styles.collapsed}`}
          aria-label = {ariaLabel}
          data-state = {isOpen ? "open" : "collapsed"}
        >
            <div className = {styles.header}>
                {isOpen && title && <span className = {styles.title} > {title} </span>}
                <button
                type = "button"
                className = {styles.toggleButton}
                onClick = {toggle}
                aria-expanded = {isOpen}
                aria-label = {isOpen ? "Collapse menu" : "Expand menu"}
                >
                    {isOpen ? (
                        <ChevronLeft size = {18} strokeWidth = {1.8} aria-hidden = "true" />
                    ) : (
                        <ChevronRight size = {18} strokeWidth = {1.8} aria-hidden = "true" />
                    )}
                </button>    
            </div>

            <div className = {styles.body} > {isOpen ? children : collapsedContent}</div>

            {isOpen && footer && <div className = {styles.footer} > {footer} </div>}
        </aside>    
    );
}

export default SideMenu;