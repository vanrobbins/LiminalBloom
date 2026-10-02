// Undo and redo from day one (spec §6), as patches: the before and after of
// just the items a command touched. Merch Mobile added an undo stack after
// the fact and wrapped each operation by hand. Here every committed change
// records itself.

import { entities, getEntity, sameExceptVersion, setEntity, type Entity, type EntityKey } from "./entities";
import { normalize } from "./normalize";
import type { Layout } from "./types";

export type Change = { before: Entity | undefined; after: Entity | undefined };
export type Patch = ReadonlyMap<EntityKey, Change>;
export type History = { past: Patch[]; future: Patch[] };
export type Step = { history: History; layout: Layout; skipped: boolean };

export const EMPTY_HISTORY: History = { past: [], future: [] };
export const MAX_HISTORY = 200;

export function patchBetween(before: Layout, after: Layout): Patch {
  const a = entities(before);
  const b = entities(after);
  const patch = new Map<EntityKey, Change>();
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(key);
    const y = b.get(key);
    if (!sameExceptVersion(x, y)) patch.set(key, { before: x, after: y });
  }
  return patch;
}

export function record(history: History, before: Layout, after: Layout): History {
  const patch = patchBetween(before, after);
  if (patch.size === 0) return history;
  return { past: [...history.past, patch].slice(-MAX_HISTORY), future: [] };
}

function replay(layout: Layout, patch: Patch, direction: "undo" | "redo"): Layout | null {
  // Only if nothing it touched has changed since, here or on another device.
  for (const [key, change] of patch) {
    const expected = direction === "undo" ? change.after : change.before;
    if (!sameExceptVersion(getEntity(layout, key), expected)) return null;
  }
  let next = layout;
  for (const [key, change] of patch) {
    const target = direction === "undo" ? change.before : change.after;
    const current = getEntity(layout, key);
    // Keep the version the database has now, so the next save expects it.
    next = setEntity(next, key, target && current ? ({ ...target, version: current.version } as Entity) : target);
  }
  return normalize(next);
}

export function undo(history: History, layout: Layout): Step | null {
  const patch = history.past.at(-1);
  if (!patch) return null;
  const past = history.past.slice(0, -1);
  const next = replay(layout, patch, "undo");
  if (!next) return { history: { past, future: history.future }, layout, skipped: true };
  return { history: { past, future: [...history.future, patch] }, layout: next, skipped: false };
}

export function redo(history: History, layout: Layout): Step | null {
  const patch = history.future.at(-1);
  if (!patch) return null;
  const future = history.future.slice(0, -1);
  const next = replay(layout, patch, "redo");
  if (!next) return { history: { past: history.past, future }, layout, skipped: true };
  return { history: { past: [...history.past, patch], future }, layout: next, skipped: false };
}

/** Forget entries that touch items another device changed under us. */
export function dropTouching(history: History, keys: ReadonlySet<EntityKey>): History {
  if (keys.size === 0) return history;
  const keep = (patch: Patch) => ![...patch.keys()].some((key) => keys.has(key));
  return { past: history.past.filter(keep), future: history.future.filter(keep) };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}
