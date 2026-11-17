// Which zone groups are open (DECISIONS 11-09, A1): folded to start, what you
// open is remembered on this device per store, and a group holding the
// selection opens itself. A lone group is always open: folding it hides
// everything for nothing. Groups nested inside those (the map's runs and table
// sets) are remembered the same way, by their own ids, and are never lone.

"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

const keyFor = (storeKey: string) => `liminal-bloom:open-zones:${storeKey}`;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readRaw(storeKey: string): string {
  try {
    return window.localStorage.getItem(keyFor(storeKey)) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

// Storage off (private mode) keeps a copy here, so the fold still works this visit.
const fallback = new Map<string, string>();

function write(storeKey: string, ids: readonly string[]) {
  const raw = JSON.stringify(ids);
  try {
    window.localStorage.setItem(keyFor(storeKey), raw);
  } catch {
    fallback.set(storeKey, raw);
  }
  listeners.forEach((listener) => listener());
}

/** `groupIds` are the top-level groups; `selectedGroupId` may name several, e.g. a zone and the run inside it. */
type Options = {
  storeKey: string;
  groupIds: readonly string[];
  selectedGroupId?: string | readonly (string | null)[] | null;
  /** True (the default): a lone group is always open. The map's list passes false so every zone folds. */
  keepLoneOpen?: boolean;
};

export function useOpenGroups({ storeKey, groupIds, selectedGroupId = null, keepLoneOpen = true }: Options) {
  const selected = (Array.isArray(selectedGroupId) ? selectedGroupId : [selectedGroupId]).filter((id): id is string => id !== null);
  const selectedKey = selected.join("|");
  // "[]" on the server and at hydration, so the first render matches: everything folded.
  const raw = useSyncExternalStore(
    subscribe,
    () => fallback.get(storeKey) ?? readRaw(storeKey),
    () => "[]",
  );
  const stored = useMemo(() => parse(raw), [raw]);

  // The selection's group opens itself until it's folded by hand; a new selection resets that.
  const [folded, setFolded] = useState<{ selection: string; ids: string[] }>({ selection: selectedKey, ids: [] });
  if (folded.selection !== selectedKey) setFolded({ selection: selectedKey, ids: [] });

  const lone = keepLoneOpen && groupIds.length === 1;
  const isLone = (id: string) => lone && groupIds.includes(id);
  const isOpen = (id: string) => isLone(id) || stored.includes(id) || (selected.includes(id) && !folded.ids.includes(id));

  function toggle(id: string) {
    if (isLone(id)) return;
    if (isOpen(id)) {
      write(storeKey, stored.filter((x) => x !== id));
      if (selected.includes(id)) setFolded({ selection: selectedKey, ids: [...folded.ids, id] });
    } else {
      write(storeKey, [...stored, id]);
      if (folded.ids.includes(id)) setFolded({ selection: selectedKey, ids: folded.ids.filter((x) => x !== id) });
    }
  }

  return { isOpen, toggle, canFold: !lone };
}
