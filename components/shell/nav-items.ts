// Every place the main navigation can take someone. Only what is built is
// listed (docs/DECISIONS.md, 2026-09-29): each feature adds its own line here
// when it lands, and all three navigation forms pick it up.

import { CircleUser, LayoutGrid, LayoutPanelTop, MapIcon, Search, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  // First: search is the feature every role uses (§3.2), and a bottom tab on phones.
  { href: "/search", label: "Search", icon: Search },
  { href: "/products", label: "Products", icon: LayoutGrid },
  { href: "/layout", label: "Layout", icon: MapIcon },
  { href: "/planograms", label: "Planograms", icon: LayoutPanelTop },
  { href: "/account", label: "Account", icon: CircleUser },
];

/** Whether an entry is the page shown, counting pages beneath it. */
export function isCurrent(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
