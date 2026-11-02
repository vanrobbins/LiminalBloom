// The builder's undo (Part 2 spec §4 "Undo"): a session stack of moves,
// resizes and typed edits. An undo or redo is a new save of the placement's
// other fields at its current version, so it passes the same guards as any
// edit. A refusal for a placement drops its steps (another device changed it,
// and undoing past that would overwrite their work: Review Focus 2).

import type { Change, PlacementFields, PlacementView } from "../types";

export type Step = { id: string; before: PlacementFields; after: PlacementFields };
export type History = { done: readonly Step[]; undone: readonly Step[] };
export type Travel = { step: Step; change: Extract<Change, { kind: "update" }>; history: History };

export const EMPTY_HISTORY: History = { done: [], undone: [] };
const LIMIT = 50;

export function record(history: History, step: Step): History {
  return { done: [...history.done, step].slice(-LIMIT), undone: [] };
}

export function undo(history: History, placements: readonly PlacementView[]): Travel | null {
  const step = history.done.at(-1);
  const current = step ? placements.find((p) => p.id === step.id) : undefined;
  if (!step || !current) return null;
  return {
    step,
    change: { kind: "update", id: step.id, version: current.version, fields: step.before },
    history: { done: history.done.slice(0, -1), undone: [...history.undone, step] },
  };
}

export function redo(history: History, placements: readonly PlacementView[]): Travel | null {
  const step = history.undone.at(-1);
  const current = step ? placements.find((p) => p.id === step.id) : undefined;
  if (!step || !current) return null;
  return {
    step,
    change: { kind: "update", id: step.id, version: current.version, fields: step.after },
    history: { done: [...history.done, step], undone: history.undone.slice(0, -1) },
  };
}

export function forget(history: History, id: string): History {
  return { done: history.done.filter((s) => s.id !== id), undone: history.undone.filter((s) => s.id !== id) };
}

/**
 * Whether a placement still holds the fields a step left it with. A draft
 * picks up other devices' edits, so a fresh version alone doesn't say the
 * placement is untouched (Review Focus 2).
 */
export function sitsAt(placement: PlacementFields, fields: PlacementFields): boolean {
  return (
    placement.faceId === fields.faceId &&
    placement.presentation === fields.presentation &&
    placement.col === fields.col &&
    placement.row === fields.row &&
    placement.colSpan === fields.colSpan &&
    placement.rowSpan === fields.rowSpan &&
    placement.pieceCount === fields.pieceCount
  );
}

export function prune(history: History, placements: readonly PlacementView[]): History {
  const live = (s: Step) => placements.some((p) => p.id === s.id);
  return { done: history.done.filter(live), undone: history.undone.filter(live) };
}
