// Every place the main navigation can take someone. Only what is built is
// listed (docs/DECISIONS.md, 2026-09-29): each feature adds its own line here
// when it lands, and all three navigation forms pick it up.

import { CircleUser, LayoutGrid, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/products", label: "Products", icon: LayoutGrid },
  { href: "/account", label: "Account", icon: CircleUser },
];

/** Whether an entry is the page shown, counting pages beneath it. */
export function isCurrent(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
