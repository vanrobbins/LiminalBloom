// Switch between the stores this person belongs to. One tap: Better Auth
// checks membership, the session's active store changes (and is remembered
// for next sign-in), and the page re-renders on the server for the new store.
//
// A Radix ToggleGroup: one store is selected, the up and down arrows move
// between them, and the selected one is gold (§5.5, current selection).
//
// Lives in the phone's store sheet (components/shell/store-menu.tsx). The
// switching itself is in use-switch-store.ts, shared with the dropdown that
// tablet and desktop use.

"use client";

import { Plus } from "lucide-react";
import { ToggleGroup } from "radix-ui";

import { type Store, useSwitchStore } from "@/components/shell/use-switch-store";
import { Button } from "@/components/ui/button";

export function StoreSwitcher({
  stores,
  activeStoreId,
  onSwitched,
  switchingTo: parentSwitchingTo,
  switchTo: parentSwitchTo,
}: {
  stores: Store[];
  activeStoreId: string;
  /** Called once a switch has gone through, so a sheet can close. */
  onSwitched?: () => void;
  /**
   * A parent that outlives this component (the phone's sheet unmounts it on
   * close) passes its own switching state, so a reopened list stays busy.
   */
  switchingTo?: string | null;
  switchTo?: (storeId: string) => Promise<boolean>;
}) {
  const own = useSwitchStore(stores, activeStoreId);
  const switchingTo = parentSwitchingTo === undefined ? own.switchingTo : parentSwitchingTo;
  const switchTo = parentSwitchTo ?? own.switchTo;

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
        className="flex flex-col gap-2"
      >
        {stores.map((store) => (
          <ToggleGroup.Item
            key={store.id}
            value={store.id}
            data-store-name={store.name}
            className="inline-flex min-h-11 w-full items-center rounded border border-line bg-raised px-3 py-2 text-left text-sm text-ink wrap-anywhere focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-[state=on]:border-brand data-[state=on]:bg-brand data-[state=on]:font-medium data-[state=on]:text-on-brand"
          >
            {switchingTo === store.id ? "Switching…" : store.name}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <Button asChild variant="ghost">
        <a href="/create-store">
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
          New store
        </a>
      </Button>
    </div>
  );
}
