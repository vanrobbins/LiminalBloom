// The builder's state beside the draft (Part 2 spec §4): one way to save a
// move, resize or typed edit, and to add or remove a placement, each on the
// undo stack (use-history.ts), and what a screen reader hears. The first
// change with no draft starts one (beginDraftAction); if another device got
// there first, its draft is adopted and the tile found in it, or the change is
// refused (Review Focus 3). A refusal drops that placement's undo steps
// (Review Focus 2).

"use client";

import { useEffect, useRef, type RefObject } from "react";

import { beginDraftAction } from "@/app/(app)/planograms/actions";
import { useAnnouncement } from "@/components/ui/use-announcement";
import { fieldsOf, isReorder, type Verb } from "@/lib/planograms/builder/fields";
import { matchPlacement } from "@/lib/planograms/builder/match";
import type { DraftState, PlacementFields, PlacementView } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

import type { GridItem } from "./grid-items";
import type { OnTake, Pending, SaveResult } from "./use-planogram-draft";
import { flushPendingEdits } from "./use-auto-save";
import { CONFLICT, useHistory } from "./use-history";
import { useUndoKeys } from "./use-undo-keys";

export type CommitResult = { ok: true; id: string; draft?: DraftState } | { ok: false; message: string | null; gone?: true };

type Options = {
  fixtureId: string;
  draft: DraftState | null;
  expectedVersion: number | null;
  save: (pending: Pending) => Promise<SaveResult>;
  adopt: (draft: DraftState) => void;
  /** Says why on the draft's status line a refusal the server never saw (the draft hook's `refuse`). */
  refuse: (message: string) => void;
  /** The draft hook's `onLeaveRef`: set to clear the history when the draft goes. */
  onLeaveRef?: RefObject<() => void>;
  /** The draft hook's `onTakeRef`: set to map the history's depths through each draft taken in. */
  onTakeRef?: RefObject<OnTake>;
  onStarted: () => void;
  /** The first change was refused with no draft to work in: this screen is out of date, so reload it. */
  onStale: () => void;
  describe: (fields: PlacementFields) => string;
  /** False while the draft isn't the one shown (Published, a past version): Undo and Ctrl+Z do nothing. */
  enabled?: boolean;
  /** Undo or Redo landed: shows the face it landed on and names it, if that wasn't the one showing. */
  reveal?: (fields: PlacementFields) => string | null;
  /** Undo or Redo took this placement away (an add undone, a remove redone): the screen drops the selection if it was on it. */
  onGone?: (id: string) => void;
};

export function useBuilder({ fixtureId, draft, expectedVersion, save, adopt, refuse, onLeaveRef, onTakeRef, onStarted, onStale, describe, enabled = true, reveal, onGone }: Options) {
  const [announcement, say] = useAnnouncement();
  const dragging = useRef(false);
  // One start at a time: a second change before it's back waits for the same reply.
  const starting = useRef<ReturnType<typeof beginDraftAction> | null>(null);
  // Toast actions and the key listener outlive the render that made them.
  const latest = useRef({ draft, enabled, reveal, onGone });
  useEffect(() => {
    latest.current = { draft, enabled, reveal, onGone };
  });

  /** The draft to work in: the one held, or one started now (a change or an add with none), once however many ask. */
  async function draftToUse(): Promise<{ draft: DraftState } | { message: string | null }> {
    const held = latest.current.draft;
    if (held) return { draft: held };
    let pending = starting.current;
    if (!pending) {
      pending = beginDraftAction(fixtureId, expectedVersion).then((reply) => {
        if (reply.draft) {
          adopt(reply.draft);
          latest.current = { ...latest.current, draft: reply.draft };
          onStarted();
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
    return reply.draft ? { draft: reply.draft } : { message: reply.message };
  }

  async function placementFor(item: GridItem): Promise<{ placement: PlacementView } | { message: string | null }> {
    const held = latest.current.draft;
    if (held) {
      const placement = held.placements.find((p) => p.id === item.id);
      return placement ? { placement } : { message: CONFLICT };
    }
    const started = await draftToUse();
    if (!("draft" in started)) return started;
    const placement = matchPlacement(item, started.draft.placements);
    return placement ? { placement } : { message: CONFLICT };
  }

  const history = useHistory({ save, latest, dragging, say, refuse, describe });
  useEffect(() => {
    if (onLeaveRef) onLeaveRef.current = history.clear;
    if (onTakeRef) onTakeRef.current = history.take;
  });

  /** `onFound` hears which tile the change is saved to as soon as it's known: a started draft gives it a new id. */
  async function commit(item: GridItem, next: PlacementFields, verb: Verb, onFound?: (id: string) => void): Promise<CommitResult> {
    // A move or a resize leaves the depth to the server (kept, or the back when it joins others);
    // a reorder asks for its place.
    const fields = fieldsOf(next, isReorder(verb));
    let found: Awaited<ReturnType<typeof placementFor>>;
    try {
      found = await placementFor(item);
    } catch {
      toast({ tone: "error", title: "Couldn't save", description: "Check the connection and try again." });
      return { ok: false, message: null };
    }
    if (!("placement" in found)) {
      // A typed edit shows its refusal in its own form; the others on the status line.
      if (found.message && verb !== "Changed") refuse(found.message);
      return { ok: false, message: found.message };
    }
    const target = found.placement;
    onFound?.(target.id);
    const result = await save({ kind: "update", id: target.id, version: target.version, fields });
    if (!result.saved) {
      // The status line already says why: the save that was refused set it.
      if (result.message) history.forget(target.id);
      return { ok: false, message: result.message, gone: result.gone };
    }
    // What the server kept, which isn't what was sent when folded product hangs on a rail;
    // and where it sat when this change went, which a change queued behind another moved.
    const kept = result.draft.placements.find((p) => p.id === target.id);
    // Undo and Redo ask for the depth it had, so a step puts it back in its place front to back.
    const after = kept ? fieldsOf(kept, true) : fields;
    history.record({ kind: "update", id: target.id, before: fieldsOf(result.before ?? target, true), after, aheadBefore: result.ahead?.before, aheadAfter: result.ahead?.after });
    say(isReorder(verb) ? verb : `${result.notice ?? verb} to ${describe(after)}`);
    return { ok: true, id: target.id, draft: result.draft };
  }

  /**
   * An add, on the undo stack under the id the server gave it. `pick` chooses the fields among the placements it will be
   * saved beside, or says why there's no room: with no draft yet it's asked again once one has started, because that
   * draft (another device's, say) may differ from the version the screen showed.
   */
  async function add(productId: string, pick: (others: readonly PlacementView[]) => PlacementFields | string): Promise<SaveResult> {
    let started: Awaited<ReturnType<typeof draftToUse>>;
    try {
      started = await draftToUse();
    } catch {
      return { saved: false, message: "Couldn't start the draft. Check the connection and try again." };
    }
    if (!("draft" in started)) return { saved: false, message: started.message };
    const fields = pick(started.draft.placements);
    if (typeof fields === "string") return { saved: false, message: fields };
    const result = await save({ kind: "add", productId, fields });
    const placed = result.saved ? result.draft.placements.find((p) => p.id === result.id) : undefined;
    if (placed) history.record({ kind: "add", id: placed.id, productId, fields: fieldsOf(placed, true), ahead: result.saved ? result.ahead?.after : undefined });
    return result;
  }

  /** A remove, on the undo stack with everything it needs to come back. */
  async function remove(p: PlacementView): Promise<SaveResult> {
    const result = await save({ kind: "remove", id: p.id, version: p.version });
    if (result.saved) history.record({ kind: "remove", id: p.id, productId: p.productId, fields: fieldsOf(result.before ?? p, true), ahead: result.ahead?.before });
    else if (result.message) history.forget(p.id);
    return result;
  }

  // An edit still waiting in the panel goes first, so Undo takes back that edit, not the one before it.
  const afterPending = (travel: () => Promise<void>) => flushPendingEdits()?.then(travel) ?? travel();
  const undo = () => afterPending(history.undo);
  const redo = () => afterPending(history.redo);
  useUndoKeys(enabled, (direction) => void (direction === "undo" ? undo() : redo()));

  return {
    commit,
    add,
    remove,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    clearHistory: history.clear,
    say,
    refuse,
    announcement,
    setDragging: (isDragging: boolean) => {
      dragging.current = isDragging;
    },
  };
}
