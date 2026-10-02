// A layout seen as a bag of keyed items, so diffs, undo patches and saves can
// treat every kind of item the same way.

import type { Entrance, Face, Fixture, Layout, Outline, TableSet, Zone } from "./types";
import { OUTLINE_ID } from "./types";

export type Collection = "outline" | "entrances" | "zones" | "fixtures" | "faces" | "tableSets";
export type ListCollection = Exclude<Collection, "outline">;
export const LIST_COLLECTIONS: readonly ListCollection[] = ["entrances", "zones", "fixtures", "faces", "tableSets"];

export type Entity = Outline | Entrance | Zone | Fixture | Face | TableSet;
/** `${collection}:${id}` */
export type EntityKey = string;

type ListItem = Entrance | Zone | Fixture | Face | TableSet;

export function keyOf(collection: Collection, id: string): EntityKey {
  return `${collection}:${id}`;
}

export function splitKey(key: EntityKey): [Collection, string] {
  const at = key.indexOf(":");
  return [key.slice(0, at) as Collection, key.slice(at + 1)];
}

function listOf(layout: Layout, collection: ListCollection): ListItem[] {
  return layout[collection];
}

export function entities(layout: Layout): Map<EntityKey, Entity> {
  const map = new Map<EntityKey, Entity>();
  if (layout.outline) map.set(keyOf("outline", OUTLINE_ID), layout.outline);
  for (const collection of LIST_COLLECTIONS) {
    for (const item of listOf(layout, collection)) map.set(keyOf(collection, item.id), item);
  }
  return map;
}

export function getEntity(layout: Layout, key: EntityKey): Entity | undefined {
  const [collection, id] = splitKey(key);
  if (collection === "outline") return layout.outline ?? undefined;
  return listOf(layout, collection).find((item) => item.id === id);
}

/** Replace, append (if new) or remove (`undefined`) one item. */
export function setEntity(layout: Layout, key: EntityKey, value: Entity | undefined): Layout {
  const [collection, id] = splitKey(key);
  if (collection === "outline") {
    return { ...layout, outline: (value as Outline | undefined) ?? null };
  }
  const list = listOf(layout, collection);
  const index = list.findIndex((item) => item.id === id);
  let next: ListItem[];
  if (value === undefined) {
    next = index === -1 ? list : list.filter((_, i) => i !== index);
  } else if (index === -1) {
    next = [...list, value as ListItem];
  } else {
    next = list.map((item, i) => (i === index ? (value as ListItem) : item));
  }
  // The cast is safe: `value` came from the same collection named in `key`.
  return { ...layout, [collection]: next } as Layout;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/** Equal apart from the database version, which saves change and commands do not. */
export function sameExceptVersion(a: Entity | undefined, b: Entity | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return deepEqual({ ...a, version: 0 }, { ...b, version: 0 });
}

export function nameOf(entity: Entity): string | null {
  return "name" in entity ? entity.name : null;
}

/** Every id that differs, plus each changed face's fixture and each changed set's upper table. */
export function changedIds(before: Layout, after: Layout): Set<string> {
  const a = entities(before);
  const b = entities(after);
  const ids = new Set<string>();
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(key);
    const y = b.get(key);
    if (sameExceptVersion(x, y)) continue;
    const [collection, id] = splitKey(key);
    ids.add(id);
    for (const item of [x, y]) {
      if (!item) continue;
      if (collection === "faces") ids.add((item as Face).fixtureId);
      if (collection === "tableSets") ids.add((item as TableSet).upperFixtureId);
    }
  }
  return ids;
}
