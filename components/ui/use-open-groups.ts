// Which zone groups are open (DECISIONS 11-09, A1): folded to start, what you
// open is remembered on this device per store, and a group holding the
// selection opens itself. A lone group is always open: folding it hides
// everything for nothing.

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

type Options = { storeKey: string; groupIds: readonly string[]; selectedGroupId?: string | null };

export function useOpenGroups({ storeKey, groupIds, selectedGroupId = null }: Options) {
  // "[]" on the server and at hydration, so the first render matches: everything folded.
  const raw = useSyncExternalStore(
    subscribe,
    () => fallback.get(storeKey) ?? readRaw(storeKey),
    () => "[]",
  );
  const stored = useMemo(() => parse(raw), [raw]);

  // The selection's group opens itself until it's folded by hand; a new selection resets that.
  const [folded, setFolded] = useState<{ selection: string | null; id: string | null }>({ selection: selectedGroupId, id: null });
  if (folded.selection !== selectedGroupId) setFolded({ selection: selectedGroupId, id: null });

  const lone = groupIds.length === 1;
  const isOpen = (id: string) => lone || stored.includes(id) || (id === selectedGroupId && folded.id !== id);

  function toggle(id: string) {
    if (lone) return;
    if (isOpen(id)) {
      write(storeKey, stored.filter((x) => x !== id));
      if (id === selectedGroupId) setFolded({ selection: selectedGroupId, id });
    } else {
      write(storeKey, [...stored, id]);
      if (folded.id === id) setFolded({ selection: selectedGroupId, id: null });
    }
  }

  return { isOpen, toggle, canFold: !lone };
}
