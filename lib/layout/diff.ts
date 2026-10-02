// What changed between two layouts, as a change set a save can carry
// (spec §8–9). Each item carries the version it was changed from, so the
// server can tell whether someone else saved it first.

import {
  LIST_COLLECTIONS,
  entities,
  keyOf,
  sameExceptVersion,
  setEntity,
  type ListCollection,
  type Entity,
} from "./entities";
import { OUTLINE_ID, type Entrance, type Face, type Fixture, type Layout, type Outline, type TableSet, type Zone } from "./types";

export type Upsert<T> = { item: T; expectedVersion: number | null };
export type Delete = { collection: ListCollection; id: string; expectedVersion: number };

export type ChangeSet = {
  outline: Upsert<Outline> | null;
  entrances: Upsert<Entrance>[];
  zones: Upsert<Zone>[];
  fixtures: Upsert<Fixture>[];
  faces: Upsert<Face>[];
  tableSets: Upsert<TableSet>[];
  deletes: Delete[];
};

type Versioned = { id: string; version: number };

export function emptyChanges(): ChangeSet {
  return { outline: null, entrances: [], zones: [], fixtures: [], faces: [], tableSets: [], deletes: [] };
}

export function diff(base: Layout, next: Layout): ChangeSet {
  const changes = emptyChanges();
  if (next.outline && !sameExceptVersion(base.outline ?? undefined, next.outline)) {
    changes.outline = { item: next.outline, expectedVersion: base.outline ? base.outline.version : null };
  }
  for (const collection of LIST_COLLECTIONS) {
    const before = new Map((base[collection] as Versioned[]).map((item) => [item.id, item]));
    const kept = new Set<string>();
    const upserts = changes[collection] as Upsert<Versioned>[];
    for (const item of next[collection] as Versioned[]) {
      kept.add(item.id);
      const old = before.get(item.id);
      if (!old) {
        upserts.push({ item, expectedVersion: null });
      } else if (!sameExceptVersion(old as Entity, item as Entity)) {
        upserts.push({ item, expectedVersion: old.version });
      }
    }
    for (const [id, old] of before) {
      if (!kept.has(id)) changes.deletes.push({ collection, id, expectedVersion: old.version });
    }
  }
  return changes;
}

export function changeCount(changes: ChangeSet): number {
  return (
    (changes.outline ? 1 : 0) +
    LIST_COLLECTIONS.reduce((sum, collection) => sum + changes[collection].length, 0) +
    changes.deletes.length
  );
}

/** Every id a change set touches. */
export function changeIds(changes: ChangeSet): string[] {
  const ids = changes.outline ? [OUTLINE_ID] : [];
  for (const collection of LIST_COLLECTIONS) {
    for (const upsert of changes[collection] as Upsert<Versioned>[]) ids.push(upsert.item.id);
  }
  for (const gone of changes.deletes) ids.push(gone.id);
  return ids;
}

export function isEmpty(changes: ChangeSet): boolean {
  return changeCount(changes) === 0;
}

export function applyChanges(base: Layout, changes: ChangeSet): Layout {
  let layout = base;
  if (changes.outline) layout = { ...layout, outline: changes.outline.item };
  for (const collection of LIST_COLLECTIONS) {
    for (const upsert of changes[collection] as Upsert<Versioned>[]) {
      layout = setEntity(layout, keyOf(collection, upsert.item.id), upsert.item as Entity);
    }
  }
  for (const gone of changes.deletes) {
    layout = setEntity(layout, keyOf(gone.collection, gone.id), undefined);
  }
  return layout;
}

/** Ids whose expected version no longer matches `current`, and inserts of ids that already exist. */
export function versionConflicts(current: Layout, changes: ChangeSet): string[] {
  const now = entities(current);
  const conflicts: string[] = [];
  const check = (key: string, id: string, expected: number | null) => {
    const item = now.get(key);
    const ok = expected === null ? item === undefined : item !== undefined && item.version === expected;
    if (!ok) conflicts.push(id);
  };
  if (changes.outline) check(keyOf("outline", OUTLINE_ID), OUTLINE_ID, changes.outline.expectedVersion);
  for (const collection of LIST_COLLECTIONS) {
    for (const upsert of changes[collection] as Upsert<Versioned>[]) {
      check(keyOf(collection, upsert.item.id), upsert.item.id, upsert.expectedVersion);
    }
  }
  for (const gone of changes.deletes) check(keyOf(gone.collection, gone.id), gone.id, gone.expectedVersion);
  return conflicts;
}
