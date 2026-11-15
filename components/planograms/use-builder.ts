// The builder's state beside the draft (Part 2 spec §4): one way to save a
// move, resize or typed edit, and to add or remove a placement, each on the
// undo stack (use-history.ts), and what a screen reader hears. The first
// change with no draft starts one (beginDraftAction); if another device got
// there first, its draft is adopted and the tile found in it, or the change is
// refused (Review Focus 3). A refusal drops that placement's undo steps
// (Review Focus 2).

"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { beginDraftAction } from "@/app/(app)/planograms/actions";
import { fieldsOf, isReorder, type Verb } from "@/lib/planograms/builder/fields";
import { matchPlacement } from "@/lib/planograms/builder/match";
import type { DraftState, PlacementFields, PlacementView } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

import type { GridItem } from "./grid-items";
import type { Pending, SaveResult } from "./use-planogram-draft";
import { CONFLICT, useHistory } from "./use-history";
import { useUndoKeys } from "./use-undo-keys";

export type CommitResult = { ok: true; id: string } | { ok: false; message: string | null };

type Options = {
  fixtureId: string;
  draft: DraftState | null;
  expectedVersion: number | null;
  save: (pending: Pending) => Promise<SaveResult>;
  adopt: (draft: DraftState) => void;
  /** The draft hook's `onLeaveRef`: set to clear the history when the draft goes. */
  onLeaveRef?: RefObject<() => void>;
  onStarted: () => void;
  /** The first change was refused with no draft to work in: this screen is out of date, so reload it. */
  onStale: () => void;
  describe: (fields: PlacementFields) => string;
  /** False while the draft isn't the one shown (Published, a past version): Undo and Ctrl+Z do nothing. */
  enabled?: boolean;
  /** Undo or Redo landed: shows the face it landed on and names it, if that wasn't the one showing. */
  reveal?: (fields: PlacementFields) => string | null;
};

export function useBuilder({ fixtureId, draft, expectedVersion, save, adopt, onLeaveRef, onStarted, onStale, describe, enabled = true, reveal }: Options) {
  const [announcement, setAnnouncement] = useState("");
  const dragging = useRef(false);
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
    if (!reply.draft) return { message: reply.message };
    const placement = matchPlacement(item, reply.draft.placements);
    return placement ? { placement } : { message: CONFLICT };
  }

  // The same words twice must still change the live region, or a screen reader stays silent.
  const say = (text: string) => setAnnouncement((current) => (current === text ? `${text}\u200B` : text));

  const history = useHistory({ save, latest, dragging, say, describe });
  useEffect(() => {
    if (onLeaveRef) onLeaveRef.current = history.clear;
  });

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
        history.forget(target.id);
        tell(result.message);
      }
      return { ok: false, message: result.message };
    }
    // What the server kept, which isn't what was sent when folded product hangs on a rail;
    // and where it sat when this change went, which a change queued behind another moved.
    const kept = result.draft.placements.find((p) => p.id === target.id);
    // Undo and Redo ask for the depth it had, so a step puts it back in its place front to back.
    const after = kept ? fieldsOf(kept, true) : fields;
    history.record({ kind: "update", id: target.id, before: fieldsOf(result.before ?? target, true), after });
    say(isReorder(verb) ? verb : `${result.notice ?? verb} to ${describe(after)}`);
    history.offer(result.notice ?? verb, "undo");
    return { ok: true, id: target.id };
  }

  /** An add, on the undo stack under the id the server gave it. */
  async function add(productId: string, fields: PlacementFields): Promise<SaveResult> {
    const result = await save({ kind: "add", productId, fields });
    const placed = result.saved ? result.draft.placements.find((p) => p.id === result.id) : undefined;
    if (placed) history.record({ kind: "add", id: placed.id, productId, fields: fieldsOf(placed, true) });
    return result;
  }

  /** A remove, on the undo stack with everything it needs to come back. */
  async function remove(p: PlacementView): Promise<SaveResult> {
    const result = await save({ kind: "remove", id: p.id, version: p.version });
    if (result.saved) history.record({ kind: "remove", id: p.id, productId: p.productId, fields: fieldsOf(result.before ?? p, true) });
    else if (result.message) history.forget(p.id);
    return result;
  }

  useUndoKeys(enabled, (direction) => void (direction === "undo" ? history.undo() : history.redo()));

  return {
    commit,
    add,
    remove,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    clearHistory: history.clear,
    say,
    announcement,
    setDragging: (isDragging: boolean) => {
      dragging.current = isDragging;
    },
  };
}
