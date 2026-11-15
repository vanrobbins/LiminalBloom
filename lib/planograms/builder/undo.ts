// The builder's undo (Part 2 spec §4 "Undo"; 0.7.0.5): a session stack of
// moves, resizes, typed edits, adds and removes. An undo or redo is a new
// save at the placement's current version, so it passes the same guards as any
// edit: an update saves the other fields; an add brings a removed product back
// (under a new id, which `rename` points every step at); a remove takes an
// added one away. A refusal for a placement drops its steps (another device
// changed it, and undoing past that would overwrite their work: Review Focus 2).

import { frontToBack, sharesSpace } from "../layers";
import type { Change, ChangeFields, PlacementFields, PlacementView } from "../types";

/**
 * Where a tile sat in its layers when a step was recorded: the tiles overlapping it that were in front of it and those
 * behind it, and the tile just before it in the face's whole order (null: the first); undefined when it shared rail space
 * with nothing. Depth numbers don't last (a merge breaks ties, a rail past 98 is renumbered, another device reorders),
 * so a step says "behind these, in front of those, after that one" and Undo asks for that. The whole order matters too:
 * two tiles that never overlap still have an order, and a tile that overlaps both can need it.
 */
export type Ahead = { front: readonly string[]; back: readonly string[]; prev: string | null } | undefined;
type Placed = { id: string; productId: string; fields: PlacementFields; ahead?: Ahead };
export type Step = { kind: "update"; id: string; before: PlacementFields; after: PlacementFields; aheadBefore?: Ahead; aheadAfter?: Ahead } | ({ kind: "add" } & Placed) | ({ kind: "remove" } & Placed);
export type History = { done: readonly Step[]; undone: readonly Step[] };
export type Direction = "undo" | "redo";
/** `fields` are what the placement is left with, or (when it goes) what it held. */
export type Travel = { step: Step; change: Change; fields: PlacementFields; history: History };

/** The tiles overlapping this one, in front and behind (see Ahead): only overlapping tiles show which is in front. */
export function aheadOf(id: string, rows: readonly PlacementView[]): Ahead {
  const self = rows.find((r) => r.id === id);
  const sharing = self ? rows.filter((r) => sharesSpace(self, r)) : [];
  if (!self || !sharing.length) return undefined;
  const ids = (keep: (r: PlacementView) => boolean) => sharing.filter(keep).map((r) => r.id);
  const face = rows.filter((r) => r.faceId === self.faceId && r.presentation === "hung").sort(frontToBack);
  return { front: ids((r) => r.depth < self.depth), back: ids((r) => r.depth >= self.depth), prev: face[face.indexOf(self) - 1]?.id ?? null };
}

/** The fields to ask for: its place among the tiles it was behind, in front of and after (types.ts `Place`), or the depth it had if none of them is left. */
function asking(fields: PlacementFields, ahead: Ahead, placements: readonly PlacementView[]): ChangeFields {
  const there = (id: string | null) => id === null || placements.some((p) => p.id === id);
  if (!ahead || !(there(ahead.prev) || ahead.front.some(there) || ahead.back.some(there))) return fields;
  return { ...fields, depth: undefined, place: { after: ahead.prev, front: [...ahead.front], back: [...ahead.back] } };
}

export const EMPTY_HISTORY: History = { done: [], undone: [] };
const LIMIT = 50;

export function record(history: History, step: Step): History {
  return { done: [...history.done, step].slice(-LIMIT), undone: [] };
}

/** Whether this direction takes the step's placement away (an undone add, a redone remove). */
const removes = (step: Step, direction: Direction) => step.kind !== "update" && (step.kind === "add") === (direction === "undo");

/** What a placement must still hold for a step to be undone or redone over it, and which tile it must still be behind; null when it's being added. */
export function holds(step: Step, direction: Direction): { fields: PlacementFields; ahead: Ahead } | null {
  if (step.kind === "update") return direction === "undo" ? { fields: step.after, ahead: step.aheadAfter } : { fields: step.before, ahead: step.aheadBefore };
  return removes(step, direction) ? { fields: step.fields, ahead: step.ahead } : null;
}

function travel(history: History, placements: readonly PlacementView[], direction: Direction): Travel | null {
  const step = (direction === "undo" ? history.done : history.undone).at(-1);
  if (!step) return null;
  const current = placements.find((p) => p.id === step.id);
  const next = advance(history, direction);
  if (step.kind === "update") {
    const fields = direction === "undo" ? step.before : step.after;
    const asked = asking(fields, direction === "undo" ? step.aheadBefore : step.aheadAfter, placements);
    return current ? { step, change: { kind: "update", id: step.id, version: current.version, fields: asked }, fields, history: next } : null;
  }
  if (removes(step, direction)) return current ? { step, change: { kind: "remove", id: step.id, version: current.version }, fields: step.fields, history: next } : null;
  return { step, change: { kind: "add", productId: step.productId, fields: asking(step.fields, step.ahead, placements) }, fields: step.fields, history: next };
}

/** The stacks after the step on top of `direction` was undone or redone. */
export function advance(history: History, direction: Direction): History {
  const step = (direction === "undo" ? history.done : history.undone).at(-1);
  if (!step) return history;
  return direction === "undo"
    ? { done: history.done.slice(0, -1), undone: [...history.undone, step] }
    : { done: [...history.done, step], undone: history.undone.slice(0, -1) };
}

export const undo = (history: History, placements: readonly PlacementView[]) => travel(history, placements, "undo");
export const redo = (history: History, placements: readonly PlacementView[]) => travel(history, placements, "redo");

export function forget(history: History, id: string): History {
  return { done: history.done.filter((s) => s.id !== id), undone: history.undone.filter((s) => s.id !== id) };
}

/** A placement restored by Undo or Redo comes back under a new id: every step for it follows, and every step that was behind it. */
export function rename(history: History, from: string, to: string): History {
  const swap = (ids: readonly string[]) => ids.map((id) => (id === from ? to : id));
  const follow = (a: Ahead): Ahead => a && { front: swap(a.front), back: swap(a.back), prev: a.prev === from ? to : a.prev };
  const move = (s: Step): Step => {
    const named = s.id === from ? { ...s, id: to } : s;
    return named.kind === "update" ? { ...named, aheadBefore: follow(named.aheadBefore), aheadAfter: follow(named.aheadAfter) } : { ...named, ahead: follow(named.ahead) };
  };
  return { done: history.done.map(move), undone: history.undone.map(move) };
}

/**
 * Whether a placement still holds the fields a step left it with, and its place in the layers. A draft
 * picks up other devices' edits, so a fresh version alone doesn't say the
 * placement is untouched (Review Focus 2).
 */
export function sitsAt(placement: PlacementView, fields: PlacementFields, ahead: Ahead = undefined, rows: readonly PlacementView[] = []): boolean {
  return (
    placement.faceId === fields.faceId &&
    placement.presentation === fields.presentation &&
    placement.col === fields.col &&
    placement.row === fields.row &&
    placement.colSpan === fields.colSpan &&
    placement.rowSpan === fields.rowSpan &&
    placement.pieceCount === fields.pieceCount &&
    // Still in the same place among the tiles that still overlap it: another device moved it forward or back (Review Focus 2).
    behind(placement, ahead, rows)
  );
}

function behind(placement: PlacementView, ahead: Ahead, rows: readonly PlacementView[]): boolean {
  return rows.every((r) => !sharesSpace(placement, r) || (ahead?.front.includes(r.id) ? r.depth < placement.depth : !ahead?.back.includes(r.id) || r.depth >= placement.depth));
}

/** Whether the placement a step belongs to should be in the draft now: the last step done says; else the next Redo does. */
function meantToBeThere(history: History, id: string): boolean {
  const last = history.done.filter((s) => s.id === id).at(-1);
  if (last) return last.kind !== "remove";
  const next = history.undone.filter((s) => s.id === id).at(-1);
  return next?.kind !== "add";
}

/** Drops the steps of placements that should be there and aren't. One meant to be gone (removed, or an add undone) keeps its steps, and so does `except` (the one a change in flight is about). */
export function prune(history: History, placements: readonly { id: string }[], except?: string): History {
  const keep = (s: Step) => s.id === except || !meantToBeThere(history, s.id) || placements.some((p) => p.id === s.id);
  return { done: history.done.filter(keep), undone: history.undone.filter(keep) };
}
