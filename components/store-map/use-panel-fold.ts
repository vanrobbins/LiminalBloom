// Which folded parts of the fixture panel are open (DECISIONS 11-11): folded
// to start, what you open stays open on this device for every fixture, and a
// part that is in use (a curved bay's Curve, a hand-set grid) opens itself
// until it is folded by hand. Kept by the zone folds' store, under its own key.

"use client";

import { useOpenGroups } from "@/components/ui/use-open-groups";

const PANEL_KEY = "fixture-panel";
const FOLDS = ["curve", "grid"] as const;

export function usePanelFold(id: (typeof FOLDS)[number], inUse: boolean) {
  const { isOpen, toggle } = useOpenGroups({ storeKey: PANEL_KEY, groupIds: FOLDS, selectedGroupId: inUse ? id : null });
  return { open: isOpen(id), toggle: () => toggle(id) };
}
