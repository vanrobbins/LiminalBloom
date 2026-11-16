// The builder's Undo and Redo (Part 2 spec §4; 0.7.0.5 task 2): the session
// stack, and the undo or redo itself. Each is picked on its turn in the save
// queue, from the draft as it is then (DECISIONS 11-09), and goes through the
// same guards as any change. A step whose placement another device moved since
// is dropped, not replayed over their work (Review Focus 2). A placement that
// Undo or Redo brings back has a new id, which every step then follows.
// The history clears when the draft is published, discarded or gone.

"use client";

import { useRef, useState, type RefObject } from "react";

import { advance, holds, prune, rename, sitsAt, undo as undoStep, redo as redoStep, EMPTY_HISTORY, forget, record, type Direction, type History, type Step, type Travel } from "@/lib/planograms/builder/undo";
import type { DraftState, PlacementFields } from "@/lib/planograms/types";

import type { Pending, SaveResult } from "./use-planogram-draft";

export const CONFLICT = "Changed on another device";

type Options = {
  save: (pending: Pending) => Promise<SaveResult>;
  /** Read when a press is handled, not when it's made: the render that made it is long gone. */
  latest: RefObject<{ enabled: boolean; reveal?: (fields: PlacementFields) => string | null }>;
  /** True while a drag is held: Undo is ignored (store-map rule, DECISIONS 10-01). */
  dragging: RefObject<boolean>;
  say: (text: string) => void;
  /** Says why on the draft's status line (a refusal the server never saw; the server's own are already there). */
  refuse: (message: string) => void;
  describe: (fields: PlacementFields) => string;
};

export function useHistory({ save, latest, dragging, say, refuse, describe }: Options) {
  const [history, setHistoryState] = useState<History>(EMPTY_HISTORY);
  // Read by a queued Undo on its turn, before React has rendered the step a save just recorded.
  const ref = useRef(history);
  const setHistory = (next: History | ((h: History) => History)) => {
    ref.current = typeof next === "function" ? next(ref.current) : next;
    setHistoryState(ref.current);
  };
  // Bumped by every clear: an Undo or Redo still in flight when the draft went must not refill the history (its reply is for a dead draft).
  const cleared = useRef(0);
  // The tile an Undo or Redo is saving: no reply in between (a poll, another save's) may drop its step, even when the tile is already gone server-side.
  const flying = useRef<string | null>(null);
  async function travel(direction: Direction) {
    if (!latest.current.enabled || dragging.current) return;
    const clearedAt = cleared.current;
    // Picked on its turn: a change still saving is on the stack by then.
    const picked: { travel: Travel | null; pruned: History | null; moved: string | null } = { travel: null, pruned: null, moved: null };
    const result = await save((current) => {
      if (!current) return null;
      const pruned = prune(ref.current, current.placements);
      picked.pruned = pruned;
      const step = direction === "undo" ? undoStep(pruned, current.placements) : redoStep(pruned, current.placements);
      if (!step) return null;
      // Moved since by another device, though the draft now holds its fresh version.
      const placement = current.placements.find((p) => p.id === step.step.id);
      const expected = holds(step.step, direction);
      if (placement && expected && !sitsAt(placement, expected.fields, expected.ahead, current.placements)) {
        picked.moved = step.step.id;
        return null;
      }
      picked.travel = step;
      flying.current = step.step.id;
      return step.change;
    });
    flying.current = null;
    const { travel: step, pruned, moved } = picked;
    // The draft went while this was in flight (published, discarded, gone): that clear wins, whatever came back.
    if (!pruned || clearedAt !== cleared.current) return;
    if (moved) {
      setHistory(forget(pruned, moved));
      refuse(CONFLICT);
      return;
    }
    if (!step) return setHistory(pruned);
    if (result.saved) {
      // The replies have already dropped steps for tiles gone: only this step moves, under the new id if it came back.
      const renamed = step.change.kind === "add" ? result.id : undefined;
      setHistory((h) => (renamed ? rename(advance(h, direction, step.step), step.step.id, renamed) : advance(h, direction, step.step)));
      const done = direction === "undo" ? "Undone" : "Redone";
      const faceName = latest.current.reveal?.(step.fields);
      // The corner bar's Undo and Redo icons are the way back (no toast); the live region says what happened.
      return say(`${done}: ${describe(step.fields)}${faceName ? `, on ${faceName}` : ""}`);
    }
    // A refused restore is dropped; the draft's status line already says why (the save set it).
    setHistory((h) => (result.message ? forget(h, step.step.id) : h));
  }

  return {
    canUndo: history.done.length > 0,
    canRedo: history.undone.length > 0,
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    record: (step: Step) => setHistory((h) => record(h, step)),
    forget: (id: string) => setHistory((h) => forget(h, id)),
    clear: () => {
      cleared.current += 1;
      setHistory(EMPTY_HISTORY);
    },
    /** Every draft taken in: steps for tiles gone elsewhere are dropped quietly (not the one a change in flight is about). */
    take: (_held: DraftState, next: DraftState, cause?: string) => setHistory((h) => prune(h, next.placements, cause ?? flying.current ?? undefined)),
  };
}
