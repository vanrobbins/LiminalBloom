// The palette's "Switch to <store>" commands: one for each store but the active one, in the switcher's order (company
// by region, then standalone). They also match the company and region names. Split from commands.ts to keep it short.

import { Store } from "lucide-react";

import { flatStores, type GroupableStore, storeGroups } from "@/lib/store-groups";

import type { PaletteItem } from "./types";

type Action = Extract<PaletteItem, { kind: "page" | "action" }>;

export function storeSwitchCommands(stores: readonly GroupableStore[], activeStoreId: string): Action[] {
  return flatStores(storeGroups(stores))
    .filter((s) => s.id !== activeStoreId)
    .map(
      (s): Action => ({
        kind: "action",
        id: `action:store:${s.id}`,
        label: `Switch to ${s.name}`,
        keywords: ["store", s.companyName, s.regionName].filter(Boolean).join(" "),
        icon: Store,
        target: { storeId: s.id },
      }),
    );
}
