// The builder's state beside the draft (Part 2 spec §4): one way to save a
// move, resize or typed edit, the session undo stack, and what a screen reader
// hears. The first change with no draft starts one (beginDraftAction); if
// another device got there first, its draft is adopted and the tile found in
// it, or the change is refused (Review Focus 3). A refusal drops that
// placement's undo steps (Review Focus 2). Undo is ignored while a drag is
// held (store-map rule, DECISIONS 10-01). Undo and Redo pressed while a save is
// out pick their step when their turn comes (DECISIONS 11-09).

"use client";

import { useEffect, useRef, useState } from "react";

import { beginDraftAction } from "@/app/(app)/planograms/actions";
import { fieldsOf, isReorder, type Verb } from "@/lib/planograms/builder/fields";
import { matchPlacement } from "@/lib/planograms/builder/match";
import { EMPTY_HISTORY, forget, prune, record, redo as redoStep, sitsAt, undo as undoStep, type History, type Travel } from "@/lib/planograms/builder/undo";
import type { DraftState, PlacementFields, PlacementView } from "@/lib/planograms/types";
import { dismissToast, toast } from "@/lib/toast";

import type { GridItem } from "./grid-items";
import type { Pending, SaveResult } from "./use-planogram-draft";
import { useUndoKeys } from "./use-undo-keys";

export type CommitResult = { ok: true; id: string } | { ok: false; message: string | null };

const CONFLICT = "Changed on another device";

type Options = {
  fixtureId: string;
  draft: DraftState | null;
  expectedVersion: number | null;
  save: (pending: Pending) => Promise<SaveResult>;
  adopt: (draft: DraftState) => void;
  onStarted: () => void;
  /** The first change was refused with no draft to work in: this screen is out of date, so reload it. */
  onStale: () => void;
  describe: (fields: PlacementFields) => string;
  /** False while the draft isn't the one shown (Published, a past version): Undo and Ctrl+Z do nothing. */
  enabled?: boolean;
  /** Undo or Redo landed: shows the face it landed on and names it, if that wasn't the one showing. */
  reveal?: (fields: PlacementFields) => string | null;
};

export function useBuilder({ fixtureId, draft, expectedVersion, save, adopt, onStarted, onStale, describe, enabled = true, reveal }: Options) {
  const [history, setHistoryState] = useState<History>(EMPTY_HISTORY);
  // Read by a queued Undo on its turn, before React has rendered the step a save just recorded.
  const historyRef = useRef(history);
  const setHistory = (next: History | ((h: History) => History)) => {
    historyRef.current = typeof next === "function" ? next(historyRef.current) : next;
    setHistoryState(historyRef.current);
  };
  const [announcement, setAnnouncement] = useState("");
  const dragging = useRef(false);
  // Only the latest change offers Undo: an older toast's Undo would undo the newest step.
  const undoToast = useRef<number | null>(null);
  // One start at a time: a second change before it's back waits for the same reply.
  const starting = useRef<ReturnType<typeof beginDraftAction> | null>(null);
  // Toast actions and the key listener outlive the render that made them.
  const latest = useRef({ draft, enabled, reveal });
  useEffect(() => {
    latest.current = { draft, enabled, reveal };
  });

  async function placementFor(item: GridItem): Promise<{ placement: PlacementView } | { message: string | null }> {
    const held = latest.current.draft;
    if (held) {
      const placement = held.placements.find((p) => p.id === item.id);
      return placement ? { placement } : { message: CONFLICT };
    }
    let pending = starting.current;
    if (!pending) {
      pending = beginDraftAction(fixtureId, expectedVersion).then((reply) => {
        if (reply.draft) {
          adopt(reply.draft);
          latest.current = { ...latest.current, draft: reply.draft };
          onStarted();
          toast({ tone: "success", title: "Draft started" });
        } else if (reply.status === "refused") {
          // Published or discarded elsewhere since this page loaded: every later change would be refused too.
          onStale();
        }
        return reply;
      });
      starting.current = pending;
      pending
        .finally(() => {
          starting.current = null;
        })
        .catch(() => {});
    }
    const reply = await pending;
    if (!reply.draft) return { message: reply.status === "refused" ? reply.message : CONFLICT };
    const placement = matchPlacement(item, reply.draft.placements);
    return placement ? { placement } : { message: CONFLICT };
  }

  // The same words twice must still change the live region, or a screen reader stays silent.
  const say = (text: string) => setAnnouncement((current) => (current === text ? `${text}\u200B` : text));

  /** `onFound` hears which tile the change is saved to as soon as it's known: a started draft gives it a new id. */
  async function commit(item: GridItem, next: PlacementFields, verb: Verb, onFound?: (id: string) => void): Promise<CommitResult> {
    // A move or a resize leaves the depth to the server (kept, or the back when it joins others);
    // a reorder asks for its place.
    const fields = fieldsOf(next, isReorder(verb));
    // A typed edit shows its refusal in its own form; the others say it in a toast.
    const tell = (message: string) => {
      if (verb !== "Changed") toast({ tone: "error", title: message });
    };
    let found: Awaited<ReturnType<typeof placementFor>>;
    try {
      found = await placementFor(item);
    } catch {
      toast({ tone: "error", title: "Couldn't save", description: "Check the connection and try again." });
      return { ok: false, message: null };
    }
    if (!("placement" in found)) {
      if (found.message) tell(found.message);
      return { ok: false, message: found.message };
    }
    const target = found.placement;
    onFound?.(target.id);
    const result = await save({ kind: "update", id: target.id, version: target.version, fields });
    if (!result.saved) {
      if (result.message) {
        setHistory((h) => forget(h, target.id));
        tell(result.message);
      }
      return { ok: false, message: result.message };
    }
    // What the server kept, which isn't what was sent when folded product hangs on a rail;
    // and where it sat when this change went, which a change queued behind another moved.
    const kept = result.draft.placements.find((p) => p.id === target.id);
    // Undo and Redo ask for the depth it had, so a step puts it back in its place front to back.
    const after = kept ? fieldsOf(kept, true) : fields;
    setHistory((h) => record(h, { id: target.id, before: fieldsOf(result.before ?? target, true), after }));
    say(isReorder(verb) ? verb : `${result.notice ?? verb} to ${describe(after)}`);
    if (undoToast.current !== null) dismissToast(undoToast.current);
    undoToast.current = toast({ tone: "success", title: result.notice ?? verb, action: { label: "Undo", onSelect: () => void travel("undo") } });
    return { ok: true, id: target.id };
  }

  async function travel(direction: "undo" | "redo") {
    if (!latest.current.enabled || dragging.current) return;
    // Picked on its turn: a change still saving is on the stack by then.
    const picked: { travel: Travel | null; pruned: History | null; moved: string | null } = { travel: null, pruned: null, moved: null };
    const result = await save((current) => {
      if (!current) return null;
      const pruned = prune(historyRef.current, current.placements);
      picked.pruned = pruned;
      const step = direction === "undo" ? undoStep(pruned, current.placements) : redoStep(pruned, current.placements);
      if (!step) return null;
      // Moved since by another device, though the draft now holds its fresh version.
      const placement = current.placements.find((p) => p.id === step.step.id);
      if (placement && !sitsAt(placement, direction === "undo" ? step.step.after : step.step.before)) {
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
      setHistory(step.history);
      const done = direction === "undo" ? "Undone" : "Redone";
      const faceName = latest.current.reveal?.(step.change.fields);
      say(`${done}: ${describe(step.change.fields)}${faceName ? `, on ${faceName}` : ""}`);
      // A phone has no Ctrl+Shift+Z: the way back is in the toast.
      const back = direction === "undo" ? "redo" : "undo";
      if (undoToast.current !== null) dismissToast(undoToast.current);
      undoToast.current = toast({ tone: "success", title: done, action: { label: back === "redo" ? "Redo" : "Undo", onSelect: () => void travel(back) } });
      return;
    }
    setHistory(result.message ? forget(pruned, step.step.id) : pruned);
    if (result.message) toast({ tone: "error", title: result.message });
  }

  useUndoKeys(enabled, (direction) => void travel(direction));

  return {
    commit,
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    say,
    announcement,
    setDragging: (isDragging: boolean) => {
      dragging.current = isDragging;
    },
  };
}
