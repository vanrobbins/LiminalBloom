// The current store's name, and the store choices the account menu offers (11-22, Van: switching
// moved into the account menu so search can sit beside the store's name). The name is plain text
// on one line, never a button: on a phone it is the line under the page title (PageHeader, for
// someone in two or more stores), on the tablet rail the store's initials, in the sidebar the name.
// The shell picks the variant by where it places the name, never by measuring the screen.

"use client";

import { ArrowLeftRight, Plus } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import { DropdownMenu as Menu } from "radix-ui";

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { storeInitials } from "@/lib/initials";
import { type GroupableStore, storeGroups } from "@/lib/store-groups";

import { CompanyFootItem } from "./company-links";

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
 * A company's group or a region's group in the submenu: a menu group named by its label, so a screen
 * reader that enters it hears "Acme Coffee" or "North · 4" before the stores. No label (the flat list,
 * a region with no name) means just its children.
 */
function LabelledMenuGroup({
  heading,
  children,
}: {
  heading: string | null;
  children: ReactNode;
}) {
  const labelId = useId();
  if (!heading) {
    return <>{children}</>;
  }
  return (
    <Menu.Group aria-labelledby={labelId}>
      <div id={labelId}>
        <DropdownMenuLabel>{heading}</DropdownMenuLabel>
      </div>
      {children}
    </Menu.Group>
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
  companyName = null,
}: {
  stores: GroupableStore[];
  activeStoreId: string;
  switchingTo: string | null;
  switchTo: (storeId: string) => Promise<boolean>;
  /** A company person's company: its name is a link to /company beside New store. */
  companyName?: string | null;
}) {
  const groups = storeGroups(stores);
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
        {/* The submenu itself scrolls (its panel is capped at the available height), so there is no second scroll box here. */}
        <DropdownMenuRadioGroup
          value={activeStoreId}
          onValueChange={(id) => void switchTo(id)}
        >
          {groups.map((group) => (
            <LabelledMenuGroup key={group.key} heading={group.heading}>
              {group.regions.map((region) => (
                <LabelledMenuGroup key={region.key} heading={region.heading}>
                  {region.stores.map((store) => (
                    <DropdownMenuRadioItem
                      key={store.id}
                      value={store.id}
                      data-store-name={store.name}
                      disabled={switchingTo !== null}
                    >
                      {switchingTo === store.id ? "Switching…" : store.name}
                    </DropdownMenuRadioItem>
                  ))}
                </LabelledMenuGroup>
              ))}
            </LabelledMenuGroup>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/create-store">
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            New store
          </Link>
        </DropdownMenuItem>
        {companyName ? <CompanyFootItem name={companyName} /> : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
