// The admin area's menu where there is no sidebar (spec 0.7.1 §12): a bottom sheet on a phone, a dropdown
// on a tablet. Both hang from one Menu icon in the top bar, and the shell shows whichever the screen
// wants through CSS (the sheet's button under 768 px, the dropdown's from 768 to 1023).

"use client";

import { ArrowLeft, LogOut, Menu, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useSignOut } from "@/components/shell/use-sign-out";
import { useThemeSwitch } from "@/components/shell/use-theme-switch";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

import { AdminAccountActions, AdminNavLinks } from "./admin-nav";
import { ADMIN_NAV_ITEMS, isAdminCurrent } from "./nav-items";

const TITLE = "Liminal Bloom admin";
const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-4 shrink-0" } as const;

export function AdminSheetMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon variant="ghost" aria-label="Menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title={TITLE}>
        <div className="flex flex-col gap-4">
          <AdminNavLinks onNavigate={() => setOpen(false)} />
          <AdminAccountActions onNavigate={() => setOpen(false)} />
        </div>
      </BottomSheet>
    </>
  );
}

export function AdminDropdownMenu({ email }: { email: string }) {
  const pathname = usePathname();
  const { signOut, isSigningOut } = useSignOut();
  const { isMounted, target, switchTheme } = useThemeSwitch();
  const ThemeIcon = target === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <Tooltip label="Menu">
        <DropdownMenuTrigger aria-label="Menu" className="inline-flex size-11 shrink-0 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <Menu aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block break-all">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href} aria-current={isAdminCurrent(href, pathname) ? "page" : undefined} className={isAdminCurrent(href, pathname) ? "bg-brand font-medium text-on-brand" : undefined}>
              <Icon {...ICON} />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/home">
            <ArrowLeft {...ICON} />
            Back to the app
          </Link>
        </DropdownMenuItem>
        {isMounted ? (
          <DropdownMenuItem onSelect={switchTheme}>
            <ThemeIcon {...ICON} />
            Switch to {target} theme
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={isSigningOut} onSelect={() => void signOut()}>
          <LogOut {...ICON} />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
