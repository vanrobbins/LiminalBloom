// The admin area's sections. Only what is built is listed (as components/shell/nav-items.ts): each
// section's task adds its own line, and the sidebar, the phone sheet and the tablet menu all pick it up.

import { Briefcase, Building2, History, LayoutDashboard, LifeBuoy, ShieldCheck, Store, UserSearch, type LucideIcon } from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon };

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/people", label: "People", icon: UserSearch },
  { href: "/admin/stores", label: "Stores", icon: Store },
  { href: "/admin/companies", label: "Companies", icon: Briefcase },
  { href: "/admin/help", label: "Help", icon: LifeBuoy },
  { href: "/admin/requests", label: "Company requests", icon: Building2 },
  { href: "/admin/activity", label: "Activity", icon: History },
  { href: "/admin/admins", label: "Admins", icon: ShieldCheck },
];

/** Whether a section is the page shown. Overview is /admin itself only, because every section sits beneath it. */
export function isAdminCurrent(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
