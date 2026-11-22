// Every place the main navigation can take someone. Only what is built is
// listed (docs/DECISIONS.md, 2026-09-29): each feature adds its own line here
// when it lands, and all three navigation forms pick it up.

import { House, LayoutPanelTop, MapIcon, Search, Store, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  // Home is first and where sign-in lands (0.7.0.6). Next comes finding a product, which every
  // role does (§3.2): Products, which merged with Search (Week 6.5), takes the search icon.
  // Store (0.7.0.7) is where the people, the roles and the store details live. Account is not
  // here: five tabs fit a 360 px phone, and the avatar menu has it at every size.
  { href: "/home", label: "Home", icon: House },
  { href: "/products", label: "Products", icon: Search },
  { href: "/layout", label: "Layout", icon: MapIcon },
  { href: "/planograms", label: "Planograms", icon: LayoutPanelTop },
  { href: "/store", label: "Store", icon: Store },
];

/** Whether an entry is the page shown, counting pages beneath it. */
export function isCurrent(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
