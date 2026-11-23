// The signed-in person's menu: who they are, their stores (switching and adding one, moved here
// from the store name 11-22), their Account page, the theme, and signing out. A bottom sheet on a phone, a dropdown on tablet and
// desktop (§5.2). The shell picks the variant by where it places the menu.
//
// The avatar is deliberately not gold: gold is for the brand mark, the
// primary action and the current selection only (§5.5).

"use client";

import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { StoreSwitcher } from "@/components/store-switcher";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { helpLabel } from "@/lib/help/label";
import { personInitial } from "@/lib/initials";

import { useShellSheet } from "./shell-context";
import { StoreMenuItems } from "./store-menu";
import { DropdownRows, ICON, SheetRows } from "./user-menu-items";
import { type Store, useSwitchStore } from "./use-switch-store";
import { useSignOut } from "./use-sign-out";
import { useThemeSwitch } from "./use-theme-switch";
import { NameTip, Tooltip } from "@/components/ui/tooltip";

export type UserMenuVariant = "sheet" | "rail" | "sidebar";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const TRIGGER: Record<UserMenuVariant, string> = {
  sheet: `inline-flex size-11 shrink-0 items-center justify-center rounded-full ${FOCUS}`,
  rail: `inline-flex size-11 shrink-0 items-center justify-center rounded-full ${FOCUS}`,
  sidebar: `flex min-h-11 w-full items-center gap-3 rounded px-2 text-left text-sm text-ink ${FOCUS}`,
};

export function UserMenu({
  user,
  variant,
  stores,
  activeStoreId,
  isPlatformAdmin = false,
  helpReplies = 0,
}: {
  user: { name: string; email: string };
  variant: UserMenuVariant;
  stores: Store[];
  activeStoreId: string;
  /** A Liminal Bloom admin gets a link to /admin; the area guards itself. */
  isPlatformAdmin?: boolean;
  /** Replies from Liminal Bloom not yet opened: a dot on the avatar and the count beside Help. */
  helpReplies?: number;
}) {
  const [isSheetOpen, setIsSheetOpen] = useShellSheet("account");
  // Held here, not in the store list: the sheet and the dropdown unmount their content on close,
  // and a reopened menu must still know a switch is on its way.
  const { switchingTo, switchTo } = useSwitchStore(activeStoreId);
  // The phone sheet's second step: its store list, like the dropdown's submenu. Back to the menu on close.
  const [showStores, setShowStores] = useState(false);
  const openSheet = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) setShowStores(false);
  };
  const { isMounted, target, switchTheme } = useThemeSwitch();
  const { signOut, isSigningOut } = useSignOut();

  const themeLabel = `Switch to ${target} theme`;
  const ThemeIcon = target === "dark" ? Moon : Sun;

  const avatar = (
    <span
      aria-hidden="true"
      className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-line-subtle font-medium text-ink"
    >
      {personInitial(user.name, user.email)}
      {/* The count in words is on the Help item inside the menu; the dot only says there is something to read. */}
      {helpReplies > 0 ? <span data-help-dot className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-raised bg-info" /> : null}
    </span>
  );
  const rows = { help: helpLabel(helpReplies), isPlatformAdmin, isMounted, themeLabel, ThemeIcon, switchTheme, signOut: () => void signOut(), isSigningOut };

  if (variant === "sheet") {
    return (
      <>
        <Tooltip label="Account menu">
          <button
            type="button"
            data-user-menu
            aria-label="Account menu"
            aria-haspopup="dialog"
            aria-expanded={isSheetOpen}
            onClick={() => openSheet(true)}
            className={TRIGGER.sheet}
          >
            {avatar}
          </button>
        </Tooltip>

        <BottomSheet
          open={isSheetOpen}
          onOpenChange={openSheet}
          title={showStores ? "Switch store" : user.name.trim() || "Account"}
        >
          {showStores ? (
            <div className="flex flex-col gap-3">
              <Button
                variant="ghost"
                className="self-start"
                onClick={() => setShowStores(false)}
              >
                <ArrowLeft {...ICON} />
                Back
              </Button>
              <StoreSwitcher
                stores={stores}
                activeStoreId={activeStoreId}
                switchingTo={switchingTo}
                switchTo={switchTo}
                onSwitched={() => openSheet(false)}
              />
            </div>
          ) : (
            <SheetRows email={user.email} close={() => openSheet(false)} showStores={() => setShowStores(true)} {...rows} />
          )}
        </BottomSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <NameTip label={variant === "rail" ? "Account menu" : null}>
        <DropdownMenuTrigger
          data-user-menu
          aria-label={
            variant === "rail" || !user.name.trim() ? "Account menu" : undefined
          }
          className={TRIGGER[variant]}
        >
          {avatar}
          {variant === "sidebar" ? (
            <span className="min-w-0 wrap-break-word">{user.name}</span>
          ) : null}
        </DropdownMenuTrigger>
      </NameTip>

      <DropdownMenuContent side={variant === "rail" ? "right" : "top"}>
        <DropdownMenuLabel>
          <span className="block font-medium text-ink">{user.name}</span>
          <span className="block break-all">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <StoreMenuItems
          stores={stores}
          activeStoreId={activeStoreId}
          switchingTo={switchingTo}
          switchTo={switchTo}
        />
        <DropdownMenuSeparator />
        <DropdownRows {...rows} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
