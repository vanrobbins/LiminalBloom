// The browser's side of saving (spec §9), kept pure so every case can be
// tested without a network. One request is in flight at a time, and edits
// made meanwhile wait and go together in the next save. Merch Mobile's
// "local-first fixture move" race came from saves overtaking each other.

import { diff, isEmpty, type ChangeSet, type Upsert } from "./diff";
import { LIST_COLLECTIONS, entities, keyOf, nameOf, setEntity, type Entity, type EntityKey } from "./entities";
import { normalize } from "./normalize";
import { OUTLINE_ID, type Layout } from "./types";

export const SAVE_DELAY_MS = 600;
const MAX_RETRY_MS = 30_000;

export type Queue = { confirmed: Layout; inFlight: ChangeSet | null; attempt: number };
export type Rebased = { layout: Layout; dropped: Set<EntityKey>; droppedNames: string[] };

export function createQueue(confirmed: Layout): Queue {
  return { confirmed, inFlight: null, attempt: 0 };
}

export function hasPending(queue: Queue, present: Layout): boolean {
  return queue.inFlight !== null || !isEmpty(diff(queue.confirmed, present));
}

export function begin(queue: Queue, present: Layout): { queue: Queue; request: ChangeSet } | null {
  if (queue.inFlight) return null;
  const request = diff(queue.confirmed, present);
  if (isEmpty(request)) return null;
  return { queue: { ...queue, inFlight: request }, request };
}

/** A save that never reached the server: try again later, waiting longer each time. */
export function failed(queue: Queue): { queue: Queue; retryInMs: number } {
  const attempt = queue.attempt + 1;
  return {
    queue: { ...queue, inFlight: null, attempt },
    retryInMs: Math.min(1000 * 2 ** (attempt - 1), MAX_RETRY_MS),
  };
}

/**
 * This device's unsaved changes (from `base` to `present`), laid over what the server has now.
 * `sent` holds the ids in the request just answered: their new server version is our own save.
 * Any other change whose item moved on under it was edited elsewhere, so theirs wins (spec §1).
 */
export function rebase(
  present: Layout,
  base: Layout,
  server: Layout,
  skip: ReadonlySet<string> = new Set(),
  sent: ReadonlySet<string> = new Set(),
): Rebased {
  const pending = diff(base, present);
  const serverItems = entities(server);
  const dropped = new Set<EntityKey>();
  const droppedNames: string[] = [];
  let layout = server;

  const editedElsewhere = (id: string, expected: number | null, now: Entity | undefined) =>
    expected !== null && !sent.has(id) && now !== undefined && now.version !== expected;
  const drop = (key: EntityKey, item: Entity | undefined) => {
    dropped.add(key);
    const name = item ? nameOf(item) : null;
    if (name) droppedNames.push(name);
  };

  const take = (key: EntityKey, id: string, upsert: Upsert<Entity>) => {
    const now = serverItems.get(key);
    // A conflict, or a change to something changed or deleted elsewhere: theirs wins.
    if (skip.has(id) || (upsert.expectedVersion !== null && now === undefined) || editedElsewhere(id, upsert.expectedVersion, now)) {
      drop(key, upsert.item);
      return;
    }
    layout = setEntity(layout, key, { ...upsert.item, version: now?.version ?? 0 } as Entity);
  };

  if (pending.outline) take(keyOf("outline", OUTLINE_ID), OUTLINE_ID, pending.outline);
  for (const collection of LIST_COLLECTIONS) {
    for (const upsert of pending[collection] as Upsert<Entity & { id: string }>[]) {
      take(keyOf(collection, upsert.item.id), upsert.item.id, upsert);
    }
  }
  for (const gone of pending.deletes) {
    const key = keyOf(gone.collection, gone.id);
    const now = serverItems.get(key);
    if (skip.has(gone.id)) {
      dropped.add(key);
      continue;
    }
    if (editedElsewhere(gone.id, gone.expectedVersion, now)) {
      drop(key, now);
      continue;
    }
    layout = setEntity(layout, key, undefined);
  }
  // Server ids that conflicted come back as the server has them.
  for (const id of skip) {
    for (const [key] of serverItems) if (key.endsWith(`:${id}`)) dropped.add(key);
  }
  return { layout: normalize(layout), dropped, droppedNames };
}

export function conflictNotice(rebased: Rebased): string | null {
  if (rebased.dropped.size === 1 && rebased.droppedNames.length === 1) return `${rebased.droppedNames[0]} was changed on another device.`;
  if (rebased.dropped.size > 0) return "Some changes were made on another device.";
  return null;
}
