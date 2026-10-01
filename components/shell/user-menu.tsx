// The signed-in person's menu: who they are, their Account page, the theme,
// and signing out. A bottom sheet on a phone, a dropdown on tablet and
// desktop (§5.2). The shell picks the variant by where it places the menu.
//
// The avatar is deliberately not gold: gold is for the brand mark, the
// primary action and the current selection only (§5.5).

"use client";

import { CircleUser, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { personInitial } from "@/lib/initials";

import { useSignOut } from "./use-sign-out";
import { useThemeSwitch } from "./use-theme-switch";

export type UserMenuVariant = "sheet" | "rail" | "sidebar";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const TRIGGER: Record<UserMenuVariant, string> = {
  sheet: `inline-flex size-11 shrink-0 items-center justify-center rounded-full ${FOCUS}`,
  rail: `inline-flex size-11 shrink-0 items-center justify-center rounded-full ${FOCUS}`,
  sidebar: `flex min-h-11 w-full items-center gap-3 rounded px-2 text-left text-sm text-ink ${FOCUS}`,
};

const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-4 shrink-0" } as const;

export function UserMenu({
  user,
  variant,
}: {
  user: { name: string; email: string };
  variant: UserMenuVariant;
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { isMounted, target, switchTheme } = useThemeSwitch();
  const { signOut, isSigningOut } = useSignOut();

  const themeLabel = `Switch to ${target} theme`;
  const ThemeIcon = target === "dark" ? Moon : Sun;

  const avatar = (
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-line-subtle font-medium text-ink"
    >
      {personInitial(user.name, user.email)}
    </span>
  );

  if (variant === "sheet") {
    return (
      <>
        <button
          type="button"
          data-user-menu
          aria-label="Account menu"
          aria-haspopup="dialog"
          aria-expanded={isSheetOpen}
          onClick={() => setIsSheetOpen(true)}
          className={TRIGGER.sheet}
        >
          {avatar}
        </button>

        <BottomSheet
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          title={user.name.trim() || "Account"}
        >
          <div className="flex flex-col gap-3">
            <p className="break-all text-sm text-ink-muted">{user.email}</p>
            <Button asChild variant="secondary">
              <Link href="/account" onClick={() => setIsSheetOpen(false)}>
                <CircleUser {...ICON} />
                Account
              </Link>
            </Button>
            {isMounted ? (
              <Button variant="secondary" onClick={switchTheme}>
                <ThemeIcon {...ICON} />
                {themeLabel}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              loading={isSigningOut}
              loadingText="Signing out…"
              onClick={() => void signOut()}
            >
              <LogOut {...ICON} />
              Sign out
            </Button>
          </div>
        </BottomSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-user-menu
        aria-label={variant === "rail" || !user.name.trim() ? "Account menu" : undefined}
        className={TRIGGER[variant]}
      >
        {avatar}
        {variant === "sidebar" ? <span className="min-w-0 wrap-anywhere">{user.name}</span> : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent side={variant === "rail" ? "right" : "top"}>
        <DropdownMenuLabel>
          <span className="block font-medium text-ink">{user.name}</span>
          <span className="block break-all">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <CircleUser {...ICON} />
            Account
          </Link>
        </DropdownMenuItem>
        {isMounted ? (
          <DropdownMenuItem onSelect={switchTheme}>
            <ThemeIcon {...ICON} />
            {themeLabel}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isSigningOut} onSelect={() => void signOut()}>
          <LogOut {...ICON} />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
