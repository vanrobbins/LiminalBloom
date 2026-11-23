// The rows of the avatar menu below the store list: Account, Help, the admin link, the theme and Sign out. One
// set for the phone's bottom sheet, one for the dropdown. Split from user-menu.tsx to keep each file short.

"use client";

import { ArrowLeftRight, ChevronRight, CircleUser, LifeBuoy, LogOut, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

import { CompanyMenuItem, CompanySheetRow } from "./company-links";

export const ICON = {
  "aria-hidden": true,
  strokeWidth: 1.75,
  className: "size-4 shrink-0",
} as const;

export type MenuRowsProps = {
  /** The Help row's words, with the reply count when there is one. */
  help: string;
  /** A company person gets a link to /company; the page guards itself. */
  hasCompany: boolean;
  /** A Liminal Bloom admin gets a link to /admin; the area guards itself. */
  isPlatformAdmin: boolean;
  /** The theme row is left out until the browser's theme is known. */
  isMounted: boolean;
  themeLabel: string;
  ThemeIcon: LucideIcon;
  switchTheme: () => void;
  signOut: () => void;
  isSigningOut: boolean;
};

/** The phone sheet's first step. `close` runs when a link is followed; `showStores` opens the second step. */
export function SheetRows({ email, close, showStores, ...rows }: MenuRowsProps & { email: string; close: () => void; showStores: () => void }) {
  const { help, hasCompany, isPlatformAdmin, isMounted, themeLabel, ThemeIcon, switchTheme, signOut, isSigningOut } = rows;
  return (
    <div className="flex flex-col gap-3">
      <p className="break-all text-sm text-ink-muted">{email}</p>
      <Button variant="secondary" data-store-switch onClick={showStores}>
        <ArrowLeftRight {...ICON} />
        Switch store
        <ChevronRight {...ICON} className="ml-auto size-4 shrink-0" />
      </Button>
      <Button asChild variant="secondary">
        <Link href="/account" onClick={close}>
          <CircleUser {...ICON} />
          Account
        </Link>
      </Button>
      {hasCompany ? <CompanySheetRow close={close} /> : null}
      <Button asChild variant="secondary">
        <Link href="/help" onClick={close}>
          <LifeBuoy {...ICON} />
          {help}
        </Link>
      </Button>
      {isPlatformAdmin ? (
        <Button asChild variant="secondary">
          <Link href="/admin" onClick={close}>
            <ShieldCheck {...ICON} />
            Liminal Bloom admin
          </Link>
        </Button>
      ) : null}
      {isMounted ? (
        <Button variant="secondary" onClick={switchTheme}>
          <ThemeIcon {...ICON} />
          {themeLabel}
        </Button>
      ) : null}
      <Button variant="secondary" loading={isSigningOut} loadingText="Signing out…" onClick={signOut}>
        <LogOut {...ICON} />
        Sign out
      </Button>
    </div>
  );
}

/** The dropdown's rows after the store list. */
export function DropdownRows({ help, hasCompany, isPlatformAdmin, isMounted, themeLabel, ThemeIcon, switchTheme, signOut, isSigningOut }: MenuRowsProps) {
  return (
    <>
      <DropdownMenuItem asChild>
        <Link href="/account">
          <CircleUser {...ICON} />
          Account
        </Link>
      </DropdownMenuItem>
      {hasCompany ? <CompanyMenuItem /> : null}
      <DropdownMenuItem asChild>
        <Link href="/help">
          <LifeBuoy {...ICON} />
          {help}
        </Link>
      </DropdownMenuItem>
      {isPlatformAdmin ? (
        <DropdownMenuItem asChild>
          <Link href="/admin">
            <ShieldCheck {...ICON} />
            Liminal Bloom admin
          </Link>
        </DropdownMenuItem>
      ) : null}
      {isMounted ? (
        <DropdownMenuItem onSelect={switchTheme}>
          <ThemeIcon {...ICON} />
          {themeLabel}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={isSigningOut} onSelect={signOut}>
        <LogOut {...ICON} />
        {isSigningOut ? "Signing out…" : "Sign out"}
      </DropdownMenuItem>
    </>
  );
}
