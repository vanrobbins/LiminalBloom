// The builder's undo (Part 2 spec §4 "Undo"; 0.7.0.5): a session stack of
// moves, resizes, typed edits, adds and removes. An undo or redo is a new
// save at the placement's current version, so it passes the same guards as any
// edit: an update saves the other fields; an add brings a removed product back
// (under a new id, which `rename` points every step at); a remove takes an
// added one away. A refusal for a placement drops its steps (another device
// changed it, and undoing past that would overwrite their work: Review Focus 2).

import type { Change, PlacementFields, PlacementView } from "../types";

type Placed = { id: string; productId: string; fields: PlacementFields };
export type Step = { kind: "update"; id: string; before: PlacementFields; after: PlacementFields } | ({ kind: "add" } & Placed) | ({ kind: "remove" } & Placed);
export type History = { done: readonly Step[]; undone: readonly Step[] };
export type Direction = "undo" | "redo";
/** `fields` are what the placement is left with, or (when it goes) what it held. */
export type Travel = { step: Step; change: Change; fields: PlacementFields; history: History };

export const EMPTY_HISTORY: History = { done: [], undone: [] };
const LIMIT = 50;

export function record(history: History, step: Step): History {
  return { done: [...history.done, step].slice(-LIMIT), undone: [] };
}

/** Whether this direction takes the step's placement away (an undone add, a redone remove). */
const removes = (step: Step, direction: Direction) => step.kind !== "update" && (step.kind === "add") === (direction === "undo");

/** What a placement must still hold for a step to be undone or redone over it; null when it's being added. */
export function holds(step: Step, direction: Direction): PlacementFields | null {
  if (step.kind === "update") return direction === "undo" ? step.after : step.before;
  return removes(step, direction) ? step.fields : null;
}

function travel(history: History, placements: readonly PlacementView[], direction: Direction): Travel | null {
  const step = (direction === "undo" ? history.done : history.undone).at(-1);
  if (!step) return null;
  const current = placements.find((p) => p.id === step.id);
  const next: History =
    direction === "undo"
      ? { done: history.done.slice(0, -1), undone: [...history.undone, step] }
      : { done: [...history.done, step], undone: history.undone.slice(0, -1) };
  if (step.kind === "update") {
    const fields = direction === "undo" ? step.before : step.after;
    return current ? { step, change: { kind: "update", id: step.id, version: current.version, fields }, fields, history: next } : null;
  }
  if (removes(step, direction)) return current ? { step, change: { kind: "remove", id: step.id, version: current.version }, fields: step.fields, history: next } : null;
  return { step, change: { kind: "add", productId: step.productId, fields: step.fields }, fields: step.fields, history: next };
}

export const undo = (history: History, placements: readonly PlacementView[]) => travel(history, placements, "undo");
export const redo = (history: History, placements: readonly PlacementView[]) => travel(history, placements, "redo");

export function forget(history: History, id: string): History {
  return { done: history.done.filter((s) => s.id !== id), undone: history.undone.filter((s) => s.id !== id) };
}

/** A placement restored by Undo or Redo comes back under a new id: every step for it follows. */
export function rename(history: History, from: string, to: string): History {
  const move = (s: Step): Step => (s.id === from ? { ...s, id: to } : s);
  return { done: history.done.map(move), undone: history.undone.map(move) };
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
    placement.pieceCount === fields.pieceCount &&
    // Depth is in the step only when it was recorded with it (fields.ts): then a change of layer elsewhere counts.
    (fields.depth === undefined || placement.depth === fields.depth)
  );
}

/** Whether the placement a step belongs to should be in the draft now: the last step done says; else the next Redo does. */
function meantToBeThere(history: History, id: string): boolean {
  const last = history.done.filter((s) => s.id === id).at(-1);
  if (last) return last.kind !== "remove";
  const next = history.undone.filter((s) => s.id === id).at(-1);
  return next?.kind !== "add";
}

/** Drops the steps of placements that should be there and aren't. One meant to be gone (removed, or an add undone) keeps its steps. */
export function prune(history: History, placements: readonly PlacementView[]): History {
  const keep = (s: Step) => !meantToBeThere(history, s.id) || placements.some((p) => p.id === s.id);
  return { done: history.done.filter(keep), undone: history.undone.filter(keep) };
}
