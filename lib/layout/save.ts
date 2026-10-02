// Applying one save (spec §8): check versions, apply, normalize, validate
// with the editor's own rules, then write everything in one guarded batch.

import "server-only";

import type { BatchItem } from "drizzle-orm/batch";

import { withStore } from "@/lib/db/with-store";

import { applyChanges, diff, isEmpty, versionConflicts, type ChangeSet } from "./diff";
import { changedIds } from "./entities";
import { loadLayout } from "./load";
import { normalize } from "./normalize";
import type { SaveResult } from "./replies";
import { newIssues, validate } from "./validate";
import { writeStatements } from "./write";

/** Drizzle wraps driver errors; the conflict label can be on any error in the cause chain. */
function messagesOf(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
    } else {
      messages.push(String(current));
      break;
    }
  }
  return messages;
}

export function conflictLabel(error: unknown): string | null {
  for (const message of messagesOf(error)) {
    const match = message.match(/layout_conflict:([\w-]+)/);
    if (match) return match[1];
  }
  return null;
}

function violates(error: unknown, matches: (constraint: string) => boolean): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof Error) {
      const constraint = (current as Error & { constraint?: unknown }).constraint;
      if (typeof constraint === "string" && matches(constraint)) return true;
      const named = current.message.match(/duplicate key value violates unique constraint "([^"]*)"/);
      if (named && matches(named[1])) return true;
      current = current.cause;
    } else break;
  }
  return false;
}

/** Only a reused primary key is a conflict; any other unique violation is a bug in write order and must surface. */
export function isDuplicateId(error: unknown): boolean {
  return violates(error, (constraint) => constraint.endsWith("_pkey"));
}

/**
 * The ids a failed write conflicted on, or null when the error is a real failure to rethrow.
 * Two devices attaching a lower table to the same table at once collide on the one-set-per-table
 * rule: that is a conflict on the table, not an outage to retry forever.
 */
export function conflictsFrom(error: unknown, writes: ChangeSet): string[] | null {
  const label = conflictLabel(error);
  if (label !== null) return [label];
  if (isDuplicateId(error)) return [];
  if (violates(error, (constraint) => constraint === "table_sets_upper_fixture_id_unique")) {
    // The new set's id too: skipping it drops this device's set (and, by normalize, its lower
    // table), or the next save would send the same insert and collide again.
    const inserted = writes.tableSets.filter((upsert) => upsert.expectedVersion === null);
    return inserted.flatMap((upsert) => [upsert.item.upperFixtureId, upsert.item.id]);
  }
  return null;
}

export async function applyLayoutChanges(storeId: string, changes: ChangeSet): Promise<SaveResult> {
  const current = await loadLayout(storeId);

  const conflicts = versionConflicts(current, changes);
  if (conflicts.length > 0) return { status: "conflict", conflicts, layout: current };

  const next = normalize(applyChanges(current, changes));
  const changed = changedIds(current, next);
  const issues = newIssues(validate(current, changed), validate(next, changed), changed);
  if (issues.length > 0) return { status: "invalid", issues, layout: current };

  // Write the normalized truth, not just what the browser sent.
  const writes = diff(current, next);
  if (isEmpty(writes)) return { status: "saved", layout: current };

  const [first, ...rest] = writeStatements(storeId, writes, current);
  try {
    await withStore(storeId, [first, ...rest] as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  } catch (error) {
    const conflicts = conflictsFrom(error, writes);
    if (conflicts === null) throw error;
    return { status: "conflict", conflicts, layout: await loadLayout(storeId) };
  }
  return { status: "saved", layout: await loadLayout(storeId) };
}
