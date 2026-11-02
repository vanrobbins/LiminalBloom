// The builder's state beside the draft (Part 2 spec §4): one way to save a
// move, resize or typed edit, the session undo stack, and what a screen reader
// hears. The first change with no draft starts one (beginDraftAction); if
// another device got there first, its draft is adopted and the tile found in
// it, or the change is refused (Review Focus 3). A refusal drops that
// placement's undo steps (Review Focus 2). Undo is ignored while a drag is
// held (store-map rule, DECISIONS 10-01).

"use client";

import { useEffect, useRef, useState } from "react";

import { beginDraftAction } from "@/app/(app)/planograms/actions";
import { matchPlacement } from "@/lib/planograms/builder/match";
import { EMPTY_HISTORY, forget, prune, record, redo as redoStep, sitsAt, undo as undoStep, type History } from "@/lib/planograms/builder/undo";
import type { Change, DraftState, PlacementFields, PlacementView } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

import type { GridItem } from "./grid-items";
import type { SaveResult } from "./use-planogram-draft";

export type Verb = "Moved" | "Resized" | "Changed";
export type CommitResult = { ok: true; id: string } | { ok: false; message: string | null };

const CONFLICT = "Changed on another device";

type Options = {
  fixtureId: string;
  draft: DraftState | null;
  expectedVersion: number | null;
  save: (change: Change) => Promise<SaveResult>;
  adopt: (draft: DraftState) => void;
  onStarted: () => void;
  describe: (fields: PlacementFields) => string;
};

/** Only a placement's own fields: a tile carries names and looks too. */
const fieldsOf = (p: PlacementFields): PlacementFields => ({
  faceId: p.faceId,
  presentation: p.presentation,
  col: p.col,
  row: p.row,
  colSpan: p.colSpan,
  rowSpan: p.rowSpan,
  pieceCount: p.pieceCount,
});

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable], [role=dialog]") !== null;

export function useBuilder({ fixtureId, draft, expectedVersion, save, adopt, onStarted, describe }: Options) {
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);
  const [announcement, setAnnouncement] = useState("");
  const dragging = useRef(false);
  // One start at a time: a second change before it's back waits for the same reply.
  const starting = useRef<ReturnType<typeof beginDraftAction> | null>(null);
  // Toast actions and the key listener outlive the render that made them.
  const latest = useRef({ history, draft });
  useEffect(() => {
    latest.current = { history, draft };
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

  async function commit(item: GridItem, next: PlacementFields, verb: Verb): Promise<CommitResult> {
    const fields = fieldsOf(next);
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
    const result = await save({ kind: "update", id: target.id, version: target.version, fields });
    if (!result.saved) {
      if (result.message) {
        setHistory((h) => forget(h, target.id));
        tell(result.message);
      }
      return { ok: false, message: result.message };
    }
    setHistory((h) => record(h, { id: target.id, before: fieldsOf(target), after: fields }));
    setAnnouncement(`${verb} to ${describe(fields)}`);
    toast({ tone: "success", title: verb, action: { label: "Undo", onSelect: () => void travel("undo") } });
    return { ok: true, id: target.id };
  }

  async function travel(direction: "undo" | "redo") {
    const { history: held, draft: current } = latest.current;
    if (dragging.current || !current) return;
    const pruned = prune(held, current.placements);
    const step = direction === "undo" ? undoStep(pruned, current.placements) : redoStep(pruned, current.placements);
    if (!step) return setHistory(pruned);
    // Moved since by another device, though the draft now holds its fresh version.
    const placement = current.placements.find((p) => p.id === step.step.id);
    if (placement && !sitsAt(placement, direction === "undo" ? step.step.after : step.step.before)) {
      setHistory(forget(pruned, step.step.id));
      toast({ tone: "error", title: CONFLICT });
      return;
    }
    const result = await save(step.change);
    if (result.saved) {
      setHistory(step.history);
      setAnnouncement(`${direction === "undo" ? "Undone" : "Redone"}: ${describe(step.change.fields)}`);
      return;
    }
    setHistory(result.message ? forget(pruned, step.step.id) : pruned);
    if (result.message) toast({ tone: "error", title: result.message });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "z" || isTyping(event.target)) return;
      event.preventDefault();
      void travel(event.shiftKey ? "redo" : "undo");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return {
    commit,
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    say: setAnnouncement,
    announcement,
    setDragging: (isDragging: boolean) => {
      dragging.current = isDragging;
    },
  };
}
