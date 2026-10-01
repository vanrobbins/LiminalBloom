// The current store, and the way to change it. §5.2: on a phone it opens a
// bottom sheet; on tablet and desktop a menu drops down from the button. The
// shell picks the variant by where it places the menu -- top bar, rail or
// sidebar -- never by measuring the screen.

"use client";

import { ChevronDown, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StoreSwitcher } from "@/components/store-switcher";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { storeInitials } from "@/lib/initials";

import { type Store, useSwitchStore } from "./use-switch-store";

export type StoreMenuVariant = "sheet" | "initials" | "name";

const TRIGGER_BASE =
  "inline-flex min-h-11 items-center gap-2 rounded border border-line bg-raised text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const TRIGGER: Record<StoreMenuVariant, string> = {
  sheet: `${TRIGGER_BASE} min-w-0 max-w-full px-3 py-2 text-left`,
  initials: `${TRIGGER_BASE} size-11 shrink-0 justify-center`,
  name: `${TRIGGER_BASE} w-full justify-between px-3 py-2 text-left`,
};

export function StoreMenu({
  stores,
  activeStoreId,
  variant,
}: {
  stores: Store[];
  activeStoreId: string;
  variant: StoreMenuVariant;
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { switchingTo, switchTo } = useSwitchStore(stores, activeStoreId);

  const name = stores.find((store) => store.id === activeStoreId)?.name ?? "Your store";
  // Starts with the visible name, so speech input can say what it sees.
  const label = `${name}, switch store`;

  if (variant === "sheet") {
    return (
      <>
        <button
          type="button"
          data-store-trigger={name}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={isSheetOpen}
          onClick={() => setIsSheetOpen(true)}
          className={TRIGGER.sheet}
        >
          <span data-store-label className="min-w-0 wrap-anywhere">
            {name}
          </span>
          <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
        </button>

        <BottomSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} title="Stores">
          <StoreSwitcher
            stores={stores}
            activeStoreId={activeStoreId}
            switchingTo={switchingTo}
            switchTo={switchTo}
            onSwitched={() => setIsSheetOpen(false)}
          />
        </BottomSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-store-trigger={name} aria-label={label} className={TRIGGER[variant]}>
        {variant === "initials" ? (
          <span aria-hidden="true">{storeInitials(name)}</span>
        ) : (
          <>
            <span data-store-label className="min-w-0 wrap-anywhere">
              {name}
            </span>
            <ChevronsUpDown aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent side={variant === "initials" ? "right" : "bottom"}>
        <DropdownMenuLabel>Stores</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={activeStoreId} onValueChange={(id) => void switchTo(id)}>
          {stores.map((store) => (
            <DropdownMenuRadioItem
              key={store.id}
              value={store.id}
              data-store-name={store.name}
              disabled={switchingTo !== null}
            >
              {switchingTo === store.id ? "Switching…" : store.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/create-store">
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            New store
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
