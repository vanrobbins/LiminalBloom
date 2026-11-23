// The current store's name, and the store choices the account menu offers (11-22, Van: switching
// moved into the account menu so search can sit beside the store's name). The name is plain text
// on one line, never a button: on a phone it is the line under the page title (PageHeader, for
// someone in two or more stores), on the tablet rail the store's initials, in the sidebar the name.
// The shell picks the variant by where it places the name, never by measuring the screen.

"use client";

import { ArrowLeftRight, Plus } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { storeInitials } from "@/lib/initials";

import type { Store } from "./use-switch-store";

export type StoreNameVariant = "sheet" | "initials" | "name";

export const activeStoreName = (stores: Store[], activeStoreId: string) =>
  stores.find((store) => store.id === activeStoreId)?.name ?? "Your store";

const NAME: Record<StoreNameVariant, string> = {
  sheet: "min-w-0 truncate py-2 text-sm text-ink-muted",
  initials:
    "inline-flex size-11 shrink-0 items-center justify-center rounded border border-line-subtle text-sm font-medium text-ink",
  name: "min-w-0 truncate px-3 text-sm font-medium text-ink",
};

/** The store being worked in. `title` keeps a cut-off name whole on hover; the rail says it in full to screen readers. */
export function StoreName({
  stores,
  activeStoreId,
  variant,
}: {
  stores: Store[];
  activeStoreId: string;
  variant: StoreNameVariant;
}) {
  const name = activeStoreName(stores, activeStoreId);

  if (variant === "initials") {
    return (
      <Tooltip label={name}>
        {/* Focusable so the tooltip has a keyboard way in, like the rail's other items. */}
        <span
          tabIndex={0}
          data-store-current={name}
          className={`${NAME.initials} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
        >
          <span aria-hidden="true">{storeInitials(name)}</span>
          <span className="sr-only">{name}</span>
        </span>
      </Tooltip>
    );
  }
  return (
    <p
      data-store-current={name}
      data-store-label
      title={name}
      className={NAME[variant]}
    >
      {name}
    </p>
  );
}

/**
 * The account dropdown's "Switch store" item: a submenu of every store, the current one checked, and
 * a way to add one (11-22, Van). A submenu, not an inline list, so someone over many stores (a
 * regional manager) doesn't push Account and Sign out off the menu.
 */
export function StoreMenuItems({
  stores,
  activeStoreId,
  switchingTo,
  switchTo,
}: {
  stores: Store[];
  activeStoreId: string;
  switchingTo: string | null;
  switchTo: (storeId: string) => Promise<boolean>;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-store-switch>
        <ArrowLeftRight
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 shrink-0"
        />
        Switch store
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={activeStoreId}
          onValueChange={(id) => void switchTo(id)}
        >
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
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
