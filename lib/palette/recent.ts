// Recent picks (Van, Q6): the last 5 things chosen, per person and per store, shown when
// the field is empty. Kept in this browser only (`localStorage`), so they cost the server
// nothing, and cleared on sign-out so a shared tablet never shows the last person's picks.
// Storage can be missing or blocked (private windows, tests): every call is try/catch, and
// the palette works without it.

import { z } from "zod";

import type { PaletteItem, RecentPick } from "./types";

export const RECENT_MAX = 5;
const PREFIX = "liminal-bloom:palette-recent:";

const pickSchema = z.object({
  id: z.string().max(200),
  kind: z.enum(["planogram", "zone", "product", "page", "action"]),
  label: z.string().max(200),
  second: z.string().max(200).optional(),
  // Storage can be edited: only a path on this site is ever navigated to (not //host, a scheme or a bare word).
  href: z.string().max(300).regex(/^\/(?!\/)/),
});

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const keyOf = (userId: string, storeId: string) => `${PREFIX}${userId}:${storeId}`;

export function readRecent(userId: string, storeId: string, storage: Storage | null = browserStorage()): RecentPick[] {
  try {
    const raw = storage?.getItem(keyOf(userId, storeId));
    if (!raw) return [];
    const parsed = z.array(pickSchema).max(RECENT_MAX).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Newest first, no repeats, at most 5. Returns the list even when it could not be saved. */
export function pushRecent(userId: string, storeId: string, pick: RecentPick, storage: Storage | null = browserStorage()): RecentPick[] {
  const next = [pick, ...readRecent(userId, storeId, storage).filter((p) => p.id !== pick.id)].slice(0, RECENT_MAX);
  try {
    storage?.setItem(keyOf(userId, storeId), JSON.stringify(next));
  } catch {
    // Full or blocked: the list still works for this visit.
  }
  return next;
}

/** Every person's and store's picks in this browser; called on sign-out. */
export function clearRecent(storage: Storage | null = browserStorage()): void {
  try {
    if (!storage) return;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => k !== null && k.startsWith(PREFIX));
    for (const k of keys) storage.removeItem(k);
  } catch {
    // Nothing to clear, or blocked.
  }
}

/** What to remember about a chosen row; null for what has no address (theme, store switch, "All products"). */
export function toPick(item: PaletteItem): RecentPick | null {
  switch (item.kind) {
    case "planogram":
    case "zone":
      return { id: item.id, kind: item.kind, label: item.label, second: item.second, href: item.href };
    case "product":
      return { id: item.id, kind: "product", label: item.label, second: item.styleNumber, href: item.href };
    case "recent":
      return { id: item.id.replace(/^recent:/, ""), kind: item.of, label: item.label, ...(item.second ? { second: item.second } : {}), href: item.href };
    case "page":
    case "action":
      // A Quick Adjust command (adjustCommands) is rebuilt from what the palette loaded: it would be dropped from Recent as not a command.
      return "href" in item.target && !item.id.startsWith("action:adjust:") ? { id: item.id, kind: item.kind, label: item.label, href: item.target.href } : null;
    case "all-products":
      return null;
  }
}
