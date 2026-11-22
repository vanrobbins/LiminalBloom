// The adjust page's state (0.7.0.9 spec §4.1, §5.1): the draft this device holds, and a choice for a tile saved at once
// (R3). The first choice opens the draft if there is none (copying the published adjustment's changes). Choices go one
// at a time, each under its own change's version, so only another device's change to the same tile conflicts. Every
// reply carries the whole draft. Undo and Redo step one tile's choice (before and after); the stack clears on a conflict,
// and when the draft is gone (published, discarded or ended elsewhere), as the builder's does.

"use client";

import { useRef, useState } from "react";

import { openAdjustmentAction, setChangeAction } from "@/app/(app)/planograms/adjust-actions";
import type { DraftStatus } from "@/components/planograms/use-planogram-draft";
import { useAnnouncement } from "@/components/ui/use-announcement";
import { targetKey, type AdjustmentState, type ChangeRow, type TargetRef } from "@/lib/planograms/adjust";
import type { ProductLook, SnapshotEntry } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

export type Choice = { kind: "keep" } | { kind: "empty" } | { kind: "replace"; productId: string };
type Step = { ref: TargetRef; before: Choice; after: Choice };
type History = { done: Step[]; undone: Step[] };

export const CONFLICT = "Changed on another device";
const NONE: History = { done: [], undone: [] };
const KEEP: Choice = { kind: "keep" };

export const refOf = (e: SnapshotEntry): TargetRef => ({ faceId: e.faceId, productId: e.productId, col: e.col, row: e.row, depth: e.depth ?? 0 });

/** What a tile's change is, as a choice: no change reads as Keep. */
export const choiceOf = (changes: readonly ChangeRow[], ref: TargetRef): Choice => {
  const found = changes.find((c) => targetKey(c.target) === targetKey(ref));
  return !found ? KEEP : found.kind === "empty" ? { kind: "empty" } : { kind: "replace", productId: found.replacement.productId };
};
const same = (a: Choice, b: Choice) => a.kind === b.kind && (a.kind !== "replace" || (b.kind === "replace" && a.productId === b.productId));

type Options = {
  fixtureId: string;
  entries: readonly SnapshotEntry[];
  draft: AdjustmentState | null;
  published: AdjustmentState | null;
  looks: Record<string, ProductLook>;
  /** The draft is gone (published, discarded or ended elsewhere): the page reloads to what is there now. */
  onGone: () => void;
};

type Applied = { saved: true; noop: boolean; before: Choice; words: string } | { saved: false; message: string | null };

export function useAdjustment({ fixtureId, entries, draft: initial, published, looks: initialLooks, onGone }: Options) {
  const [draft, setDraft] = useState(initial);
  const [looks, setLooks] = useState(initialLooks);
  const [status, setStatus] = useState<DraftStatus>({ kind: "idle" });
  const [history, setHistoryState] = useState(NONE);
  const [announcement, say] = useAnnouncement();
  // Read on a choice's turn, before React has rendered the reply of the one before it.
  const held = useRef(initial);
  const stack = useRef(NONE);
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  // Bumped by every clear: an Undo still in flight when the draft went must not refill the stack.
  const cleared = useRef(0);

  const setStack = (next: History) => {
    stack.current = next;
    setHistoryState(next);
  };
  const clear = () => {
    cleared.current += 1;
    setStack(NONE);
  };
  const hold = (next: AdjustmentState, more?: Record<string, ProductLook>) => {
    held.current = next;
    setDraft(next);
    if (more) setLooks((l) => ({ ...l, ...more }));
  };
  const queued = <T,>(run: () => Promise<T>): Promise<T> => {
    const turn = tail.current.then(run);
    tail.current = turn.catch(() => null);
    return turn;
  };

  const words = (entry: SnapshotEntry, choice: Choice, next: AdjustmentState) => {
    const change = next.changes.find((c) => targetKey(c.target) === targetKey(entry));
    if (choice.kind === "replace" && change?.kind === "replace") return `${change.replacement.productName} replaces ${entry.productName}`;
    return choice.kind === "empty" ? `${entry.fixtureName} · ${entry.faceLabel} left empty` : `${entry.productName} kept`;
  };

  /** A refusal: said on the status line and to the caller. A conflict drops the history; no draft left means it is gone. */
  function refused(message: string, from: AdjustmentState | null): Applied {
    if (from) hold(from);
    if (!from || message === CONFLICT) clear();
    if (!from) {
      held.current = null;
      setStatus({ kind: "idle" });
      onGone();
      return { saved: false, message: null };
    }
    setStatus({ kind: "refused", message });
    return { saved: false, message };
  }

  async function apply(entry: SnapshotEntry, choice: Choice): Promise<Applied> {
    const ref = refOf(entry);
    setStatus({ kind: "saving" });
    try {
      let current = held.current;
      // The choice a tile already has opens nothing: with no draft yet, the published adjustment is what it has.
      const had = choiceOf((current ?? published)?.changes ?? [], ref);
      if (same(had, choice)) {
        setStatus({ kind: "idle" });
        return { saved: true, noop: true, before: had, words: "" };
      }
      if (!current) {
        const opened = await openAdjustmentAction(fixtureId);
        if (opened.status !== "saved") return refused(opened.message, opened.draft);
        hold(opened.draft, opened.looks);
        current = opened.draft;
      }
      const before = choiceOf(current.changes, ref);
      const existing = current.changes.find((c) => targetKey(c.target) === targetKey(ref));
      const reply = await setChangeAction(fixtureId, current.id, ref, choice, existing?.version ?? null);
      if (reply.status !== "saved") return refused(reply.message, reply.draft);
      hold(reply.draft, reply.looks);
      setStatus({ kind: "saved" });
      return { saved: true, noop: false, before, words: words(entry, choice, reply.draft) };
    } catch {
      setStatus({ kind: "idle" });
      toast({ tone: "error", title: "Couldn't save", description: "Check the connection and try again." });
      return { saved: false, message: null };
    }
  }

  /** Saves a tile's choice; resolves to the refusal's words, or null when it went through (or there was nothing to say). */
  function choose(entry: SnapshotEntry, choice: Choice): Promise<string | null> {
    return queued(async () => {
      const at = cleared.current;
      const result = await apply(entry, choice);
      if (!result.saved) return result.message;
      if (result.noop || at !== cleared.current) return null;
      setStack({ done: [...stack.current.done, { ref: refOf(entry), before: result.before, after: choice }], undone: [] });
      say(result.words);
      return null;
    });
  }

  function travel(direction: "undo" | "redo") {
    return queued(async () => {
      const from = direction === "undo" ? stack.current.done : stack.current.undone;
      const step = from[from.length - 1];
      const entry = step ? entries.find((e) => targetKey(e) === targetKey(step.ref)) : undefined;
      if (!step || !entry) return;
      const at = cleared.current;
      const result = await apply(entry, direction === "undo" ? step.before : step.after);
      if (at !== cleared.current) return;
      const { done, undone } = stack.current;
      const rest = from.slice(0, -1);
      // A refused step is dropped, not replayed over what the other device did.
      if (!result.saved) return setStack(direction === "undo" ? { done: rest, undone } : { done, undone: rest });
      setStack(direction === "undo" ? { done: rest, undone: [...undone, step] } : { done: [...done, step], undone: rest });
      say(`${direction === "undo" ? "Undone" : "Redone"}${result.noop ? "" : `: ${result.words}`}`);
    });
  }

  return {
    draft,
    looks,
    status,
    /** What the grid draws: the draft's changes, else the published adjustment's (a draft not opened yet starts as a copy of it). */
    changes: (draft ?? published)?.changes ?? [],
    canUndo: history.done.length > 0,
    canRedo: history.undone.length > 0,
    choose,
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    announcement,
    clear,
  };
}
