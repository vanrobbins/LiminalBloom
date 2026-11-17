// A draft and its Undo history as the builder keeps them, for tests: every save settles depths as the server
// does (test-layers.ts), the history drops steps for tiles gone, records a step with where the tile sat in its
// layers, and Undo and Redo go through the same guards (sitsAt) and asks as use-history.ts.

import { fieldsOf, serve, type Row } from "../test-layers";
import type { Change } from "../types";

import { advance, aheadOf, EMPTY_HISTORY, holds, prune, record, redo, rename, sitsAt, undo, type History } from "./undo";

export type Model = { rows: Row[]; history: History; next: number };

export const modelOf = (rows: readonly Row[]): Model => ({ rows: structuredClone([...rows]), history: EMPTY_HISTORY, next: 0 });

/** A save: steps for tiles gone are dropped (not the one changed), and what the caller records comes back. */
export function save(model: Model, change: Change, newId: string) {
  const held = model.rows;
  const next = serve(held, change, newId);
  const cause = change.kind === "add" ? newId : change.id;
  model.history = prune(model.history, next, cause);
  model.rows = next;
  const was = change.kind === "add" ? undefined : held.find((r) => r.id === change.id);
  return { before: was, placed: next.find((r) => r.id === cause), ahead: { before: was && aheadOf(was.id, held), after: aheadOf(cause, next) } };
}

/** Our own change, recorded on the stack as use-builder does. Returns the id an add was given. */
export function act(model: Model, change: Change): string {
  const id = `n${model.next++}`;
  const { before, placed, ahead } = save(model, change, id);
  if (change.kind === "add" && placed) model.history = record(model.history, { kind: "add", id, productId: change.productId, fields: fieldsOf(placed), ahead: ahead.after });
  else if (change.kind === "remove" && before) model.history = record(model.history, { kind: "remove", id: change.id, productId: before.productId, fields: fieldsOf(before), ahead: ahead.before });
  else if (change.kind === "update" && before && placed) model.history = record(model.history, { kind: "update", id: change.id, before: fieldsOf(before), after: fieldsOf(placed), aheadBefore: ahead.before, aheadAfter: ahead.after });
  return id;
}

/** One Undo or Redo: "refused" when the tile no longer sits where the step left it (the history is left as it was). */
export function travel(model: Model, direction: "undo" | "redo"): "none" | "refused" | "done" {
  const pruned = prune(model.history, model.rows);
  const step = (direction === "undo" ? undo : redo)(pruned, model.rows);
  if (!step) {
    model.history = pruned;
    return "none";
  }
  const placement = model.rows.find((r) => r.id === step.step.id);
  const expected = holds(step.step, direction);
  if (placement && expected && !sitsAt(placement, expected.fields, expected.ahead, model.rows)) return "refused";
  const id = `n${model.next++}`;
  save(model, step.change, id);
  model.history = advance(model.history, direction, step.step);
  if (step.change.kind === "add") model.history = rename(model.history, step.step.id, id);
  return "done";
}
