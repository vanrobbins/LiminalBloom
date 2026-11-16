// The draft as this device holds it (spec §4.3, co-editing; Part 2 §4: a draft the builder starts is adopted). Changes
// go one at a time, and a change made while another is saving waits its turn
// (DECISIONS 11-09); every reply carries the whole draft, so the other device's
// edits arrive with each save, and coming back to the tab reloads it. A reply
// older than the draft already held (a slow reload) is dropped.

"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { reloadDraftAction, saveChangeAction } from "@/app/(app)/planograms/actions";
import { aheadOf, type Ahead } from "@/lib/planograms/builder/undo";
import type { Change, DraftState, PlacementView } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

/** `note`: something to say beside Saved that is not a refusal (an add that went to the nearest open spot). */
export type DraftStatus = { kind: "idle" | "saving" } | { kind: "saved"; note?: string } | { kind: "refused"; message: string };
/**
 * A refusal's words go to the form that sent it; null when there's nothing to say there. `before` is the placement
 * as this device held it when the change went; `id` is the placement an add made (the server picks it).
 */
export type SaveResult = { saved: true; draft: DraftState; notice?: string; before?: PlacementView; id?: string; ahead?: { before: Ahead; after: Ahead } } | { saved: false; message: string | null; gone?: true };
/** A change, or one picked on its turn from the draft as it is then (Undo and Redo); null sends nothing. */
export type Pending = Change | ((held: DraftState | null) => Change | null);

/** Told of every draft this device takes in: the one it held, the new one, and the placement its own change was about. */
export type OnTake = (held: DraftState, next: DraftState, cause?: string) => void;

export const refusalOf = (result: SaveResult) => (result.saved ? null : result.message);

const newer = (current: DraftState | null, next: DraftState) => (current && current.planogramVersion > next.planogramVersion ? current : next);
const NOTE_MS = 4000;
const NOTHING: SaveResult = { saved: false, message: null };
/** Published or discarded on another device: not a failed connection, and the page reloads. */
const GONE: SaveResult = { saved: false, message: null, gone: true };

export function usePlanogramDraft(fixtureId: string, initial: DraftState | null, onGone: () => void) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<DraftStatus>({ kind: "idle" });
  // The draft as of the latest reply, before React renders it: a queued change reads it on its turn.
  const held = useRef(initial);
  const tail = useRef<Promise<SaveResult>>(Promise.resolve(NOTHING));
  const waiting = useRef(0);
  // A failed connection drops everything queued behind it: only changes made since are sent.
  const round = useRef(0);
  // Versions this device's own saves moved a placement through (id → from → to). The server
  // bumps a saved placement by exactly 1, so a change queued at an older version of ours is
  // brought up to date; another device's version is never in here, so its edit still refuses.
  const own = useRef(new Map<string, Map<number, number>>());
  const reloading = useRef(false);
  // Counts refuse() calls: a save whose count moved while it was out must not say Saved over that refusal.
  const refusals = useRef(0);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const goneRef = useRef(onGone);
  // Set by the builder: its undo history clears when the draft goes (published, discarded, gone), so no step writes to a dead draft.
  const onLeaveRef = useRef<() => void>(() => {});
  // Set by the builder: the history maps its depths through each draft taken in (use-history.ts).
  const onTakeRef = useRef<OnTake>(() => {});

  useEffect(() => {
    goneRef.current = onGone;
  });

  const hasDraft = draft !== null;
  useEffect(() => () => clearTimeout(noteTimer.current), []);

  /** This draft is published, discarded or gone (here or on another device): the history clears, then the page reloads. */
  function leave() {
    onLeaveRef.current();
    goneRef.current();
  }

  useEffect(() => {
    if (!hasDraft) return;
    // Focus and visibilitychange both fire on coming back: one reload at a time, and none while changes wait.
    function reload() {
      if (document.visibilityState !== "visible" || waiting.current > 0 || reloading.current) return;
      reloading.current = true;
      reloadDraftAction(fixtureId)
        .then((next) => {
          if (!next) return leave();
          hold(next);
        })
        .catch(() => {})
        .finally(() => {
          reloading.current = false;
        });
    }
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [fixtureId, hasDraft]);

  function hold(next: DraftState, cause?: string) {
    const prior = held.current;
    held.current = newer(prior, next);
    setDraft(held.current);
    if (prior && held.current !== prior) onTakeRef.current(prior, held.current, cause);
  }

  function rebase(change: Change): Change {
    if (change.kind === "add") return change;
    const steps = own.current.get(change.id);
    let version = change.version;
    for (let to = steps?.get(version); to !== undefined; to = steps?.get(version)) version = to;
    return version === change.version ? change : { ...change, version };
  }

  async function send(pending: Pending, sentIn: number): Promise<SaveResult> {
    if (sentIn !== round.current) return NOTHING;
    const before = held.current;
    const picked = typeof pending === "function" ? pending(before) : pending;
    if (!picked) return NOTHING;
    const change = rebase(picked);
    setStatus({ kind: "saving" });
    const refusalsAtStart = refusals.current;
    try {
      const reply = await saveChangeAction(fixtureId, change);
      const next = reply.draft;
      const cause = change.kind !== "add" ? change.id : reply.status === "saved" ? reply.id : undefined;
      if (next) hold(next, cause);
      if (reply.status === "saved") {
        if (change.kind === "update") {
          const steps = own.current.get(change.id) ?? new Map<number, number>();
          own.current.set(change.id, steps.set(change.version, change.version + 1));
        }
        if (waiting.current === 1 && refusals.current === refusalsAtStart) setStatus({ kind: "saved" });
        const was = change.kind === "add" ? undefined : before?.placements.find((p) => p.id === change.id);
        // Where it sat in its layers when the change went and after it, for the history's step (undo.ts `Ahead`).
        const ahead = { before: was && before ? aheadOf(was.id, before.placements) : undefined, after: cause ? aheadOf(cause, reply.draft.placements) : undefined };
        // Folded product moved onto a frame rack hangs instead (frame racks spec §3); the builder says so, with its Undo.
        const id = change.kind === "add" ? reply.id : undefined;
        return { saved: true, draft: reply.draft, ...(reply.notice ? { notice: reply.notice } : {}), ...(was ? { before: was } : {}), ...(id ? { id } : {}), ...(ahead.before || ahead.after ? { ahead } : {}) };
      }
      if (reply.status === "forbidden") {
        // The role lost the switch since the page loaded: nothing was written, and the draft is still there.
        setStatus({ kind: "refused", message: reply.message });
        return { saved: false, message: reply.message };
      }
      if (!reply.draft) {
        // Published or discarded on another device: the page reloads to what's there now, and nothing queued is sent.
        round.current += 1;
        setStatus({ kind: "idle" });
        leave();
        return GONE;
      }
      setStatus({ kind: "refused", message: reply.message });
      return { saved: false, message: reply.message };
    } catch {
      round.current += 1;
      setStatus({ kind: "idle" });
      toast({ tone: "error", title: "Couldn't save", description: "Check the connection and try again." });
      return NOTHING;
    }
  }

  /** Sends the change once every change before it is back. */
  function save(pending: Pending): Promise<SaveResult> {
    const sentIn = round.current;
    waiting.current += 1;
    // Chained on the promise the previous caller awaits, so that caller handles its reply (records
    // its undo step) before this change is picked and sent.
    const turn = tail.current.then(() =>
      send(pending, sentIn).finally(() => {
        waiting.current -= 1;
        if (waiting.current === 0) setStatus((s) => (s.kind === "saving" ? { kind: "idle" } : s));
      }),
    );
    tail.current = turn;
    return turn;
  }

  /** A draft this page started (beginDraftAction): held as if it came with the page. */
  function adopt(next: DraftState) {
    hold(next);
  }

  /** Something the form could not send (it was closed with a value that is not valid): said where a refusal is. */
  function refuse(message: string) {
    refusals.current += 1;
    setStatus({ kind: "refused", message });
  }

  /** Words beside Saved for what the save just did (no toast: the result is on screen). The next status replaces them; left alone they fade after a few seconds. */
  function note(message: string) {
    clearTimeout(noteTimer.current);
    setStatus({ kind: "saved", note: message });
    // Only this note is cleared: a refusal or a later save that came first is not touched.
    noteTimer.current = setTimeout(() => setStatus((s) => (s.kind === "saved" && s.note === message ? { kind: "saved" } : s)), NOTE_MS);
  }

  return { draft, status, save, adopt, leave, refuse, note, onLeaveRef: onLeaveRef as RefObject<() => void>, onTakeRef: onTakeRef as RefObject<OnTake> };
}
