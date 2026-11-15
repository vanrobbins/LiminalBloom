// The builder's Undo and Redo (Part 2 spec §4; 0.7.0.5 task 2): the session
// stack, and the undo or redo itself. Each is picked on its turn in the save
// queue, from the draft as it is then (DECISIONS 11-09), and goes through the
// same guards as any change. A step whose placement another device moved since
// is dropped, not replayed over their work (Review Focus 2). A placement that
// Undo or Redo brings back has a new id, which every step then follows.
// The history clears when the draft is published, discarded or gone.

"use client";

import { useRef, useState, type RefObject } from "react";

import { holds, prune, rename, sitsAt, undo as undoStep, redo as redoStep, EMPTY_HISTORY, forget, record, type Direction, type History, type Step, type Travel } from "@/lib/planograms/builder/undo";
import type { PlacementFields } from "@/lib/planograms/types";
import { dismissToast, toast } from "@/lib/toast";

import type { Pending, SaveResult } from "./use-planogram-draft";

export const CONFLICT = "Changed on another device";

type Options = {
  save: (pending: Pending) => Promise<SaveResult>;
  /** Read when a press is handled, not when it's made: the render that made it is long gone. */
  latest: RefObject<{ enabled: boolean; reveal?: (fields: PlacementFields) => string | null }>;
  /** True while a drag is held: Undo is ignored (store-map rule, DECISIONS 10-01). */
  dragging: RefObject<boolean>;
  say: (text: string) => void;
  describe: (fields: PlacementFields) => string;
};

export function useHistory({ save, latest, dragging, say, describe }: Options) {
  const [history, setHistoryState] = useState<History>(EMPTY_HISTORY);
  // Read by a queued Undo on its turn, before React has rendered the step a save just recorded.
  const ref = useRef(history);
  const setHistory = (next: History | ((h: History) => History)) => {
    ref.current = typeof next === "function" ? next(ref.current) : next;
    setHistoryState(ref.current);
  };
  // Only the latest change offers Undo: an older toast's Undo would undo the newest step.
  const toastId = useRef<number | null>(null);

  /** The toast that offers the way back (a phone has no Ctrl+Z). */
  function offer(title: string, action: Direction) {
    if (toastId.current !== null) dismissToast(toastId.current);
    toastId.current = toast({ tone: "success", title, action: { label: action === "undo" ? "Undo" : "Redo", onSelect: () => void travel(action) } });
  }

  async function travel(direction: Direction) {
    if (!latest.current.enabled || dragging.current) return;
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
      if (placement && expected && !sitsAt(placement, expected)) {
        picked.moved = step.step.id;
        return null;
      }
      picked.travel = step;
      return step.change;
    });
    const { travel: step, pruned, moved } = picked;
    if (!pruned) return;
    if (moved) {
      setHistory(forget(pruned, moved));
      toast({ tone: "error", title: CONFLICT });
      return;
    }
    if (!step) return setHistory(pruned);
    if (result.saved) {
      setHistory(step.change.kind === "add" && result.id ? rename(step.history, step.step.id, result.id) : step.history);
      const done = direction === "undo" ? "Undone" : "Redone";
      const faceName = latest.current.reveal?.(step.fields);
      say(`${done}: ${describe(step.fields)}${faceName ? `, on ${faceName}` : ""}`);
      return offer(done, direction === "undo" ? "redo" : "undo");
    }
    // A refused restore is dropped, and the draft's status line says why.
    setHistory(result.message ? forget(pruned, step.step.id) : pruned);
    if (result.message) toast({ tone: "error", title: result.message });
  }

  return {
    canUndo: history.done.length > 0,
    canRedo: history.undone.length > 0,
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    record: (step: Step) => setHistory((h) => record(h, step)),
    forget: (id: string) => setHistory((h) => forget(h, id)),
    clear: () => setHistory(EMPTY_HISTORY),
    offer,
  };
}
