// The admin area's navigation as a list of links, and the three account actions (Back to the app, theme,
// Sign out), for the desktop sidebar and the phone sheet. The tablet's dropdown draws the same
// destinations as menu items (admin-menu.tsx). One list of sections (nav-items.ts).

"use client";

import { ArrowLeft, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/components/shell/use-sign-out";
import { useThemeSwitch } from "@/components/shell/use-theme-switch";

import { ADMIN_NAV_ITEMS, isAdminCurrent } from "./nav-items";

const FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink";
const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-5 shrink-0" } as const;

/** The sections. `onNavigate` closes the phone sheet when a link is followed. */
export function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections">
      <ul className="flex flex-col gap-1">
        {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const current = isAdminCurrent(href, pathname);
          return (
            <li key={href}>
              {/* Gold marks the current selection (§5.5). Current and idle never share a class. */}
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded px-3 text-sm ${FOCUS} ${current ? "bg-brand font-medium text-on-brand" : "text-ink-muted"}`}
              >
                <Icon {...ICON} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Back to the app, the theme and Sign out, as the stacked buttons of the sidebar's foot and the phone sheet. */
export function AdminAccountActions({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut, isSigningOut } = useSignOut();
  const { isMounted, target, switchTheme } = useThemeSwitch();
  const ThemeIcon = target === "dark" ? Moon : Sun;
  return (
    <div className="flex flex-col gap-2">
      <Button asChild variant="secondary">
        <Link href="/home" onClick={onNavigate}>
          <ArrowLeft {...ICON} />
          Back to the app
        </Link>
      </Button>
      {isMounted ? (
        <Button variant="secondary" onClick={switchTheme}>
          <ThemeIcon {...ICON} />
          Switch to {target} theme
        </Button>
      ) : null}
      <Button variant="secondary" loading={isSigningOut} loadingText="Signing out…" onClick={() => void signOut()}>
        <LogOut {...ICON} />
        Sign out
      </Button>
    </div>
  );
}
