// Switch between the stores this person belongs to. One tap: the server action checks the person
// still reaches the store, the session's active store changes (and is remembered for next sign-in),
// and the page re-renders on the server for the new store.
//
// A Radix ToggleGroup: one store is selected, the up and down arrows move between them, and the
// selected one is gold (§5.5, current selection). A company person's stores are grouped under the
// company's name and by region (lib/store-groups.ts); everyone else sees one plain list.
//
// Lives in the phone's store sheet (components/shell/store-menu.tsx). The switching itself is in
// use-switch-store.ts, shared with the dropdown that tablet and desktop use.

"use client";

import { Plus } from "lucide-react";
import { type ReactNode, useId } from "react";
import { ToggleGroup } from "radix-ui";

import { CompanyFootLink } from "@/components/shell/company-links";
import { useSwitchStore } from "@/components/shell/use-switch-store";
import { Button } from "@/components/ui/button";
import { type GroupableStore, storeGroups } from "@/lib/store-groups";

/**
 * A company's group or a region's group: a role="group" named by its heading, so a screen reader that
 * enters it hears "Acme Coffee" or "North · 4" before the stores. With no heading (the flat list, or a
 * region with no name) it is just its children.
 */
function LabelledGroup({
  heading,
  level,
  className = "",
  children,
}: {
  heading: string | null;
  level: "h3" | "h4";
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  if (!heading) {
    return <>{children}</>;
  }
  const Heading = level;
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex flex-col gap-2"
    >
      <Heading
        id={headingId}
        className={`text-sm text-ink-muted ${className}`.trim()}
      >
        {heading}
      </Heading>
      {children}
    </div>
  );
}

export function StoreSwitcher({
  stores,
  activeStoreId,
  onSwitched,
  switchingTo: parentSwitchingTo,
  switchTo: parentSwitchTo,
  companyName = null,
}: {
  stores: GroupableStore[];
  activeStoreId: string;
  /** Called once a switch has gone through, so a sheet can close. */
  onSwitched?: () => void;
  /**
   * A parent that outlives this component (the phone's sheet unmounts it on
   * close) passes its own switching state, so a reopened list stays busy.
   */
  switchingTo?: string | null;
  switchTo?: (storeId: string) => Promise<boolean>;
  /** A company person's company: its name is a link to /company beside New store. */
  companyName?: string | null;
}) {
  const own = useSwitchStore(activeStoreId);
  const switchingTo =
    parentSwitchingTo === undefined ? own.switchingTo : parentSwitchingTo;
  const switchTo = parentSwitchTo ?? own.switchTo;
  const groups = storeGroups(stores);

  async function choose(storeId: string) {
    if (await switchTo(storeId)) {
      onSwitched?.();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup.Root
        type="single"
        orientation="vertical"
        value={activeStoreId}
        onValueChange={(storeId) => void choose(storeId)}
        aria-label="Stores"
        aria-orientation="vertical"
        className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-1"
      >
        {groups.map((group) => (
          <LabelledGroup
            key={group.key}
            heading={group.heading}
            level="h3"
            className="pt-2 font-medium"
          >
            {group.regions.map((region) => (
              <LabelledGroup
                key={region.key}
                heading={region.heading}
                level="h4"
              >
                {region.stores.map((store) => (
                  <ToggleGroup.Item
                    key={store.id}
                    value={store.id}
                    data-store-name={store.name}
                    className="inline-flex min-h-11 w-full items-center rounded border border-line bg-raised px-3 py-2 text-left text-sm text-ink wrap-break-word focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-[state=on]:border-brand data-[state=on]:bg-brand data-[state=on]:font-medium data-[state=on]:text-on-brand"
                  >
                    {switchingTo === store.id ? "Switching…" : store.name}
                  </ToggleGroup.Item>
                ))}
              </LabelledGroup>
            ))}
          </LabelledGroup>
        ))}
      </ToggleGroup.Root>

      <Button asChild variant="ghost">
        <a href="/create-store">
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
          New store
        </a>
      </Button>
      {companyName ? (
        <CompanyFootLink name={companyName} onFollow={onSwitched} />
      ) : null}
    </div>
  );
}
