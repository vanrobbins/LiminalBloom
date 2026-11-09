// The draft as this device holds it (spec §4.3, co-editing; Part 2 §4: a draft the builder starts is adopted). Changes
// go one at a time, and a change made while another is saving waits its turn
// (DECISIONS 11-09); every reply carries the whole draft, so the other device's
// edits arrive with each save, and coming back to the tab reloads it. A reply
// older than the draft already held (a slow reload) is dropped.

"use client";

import { useEffect, useRef, useState } from "react";

import { reloadDraftAction, saveChangeAction } from "@/app/(app)/planograms/actions";
import type { Change, DraftState, PlacementView } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

export type DraftStatus = { kind: "idle" | "saving" | "saved" } | { kind: "refused"; message: string };
/** A refusal's words go to the form that sent it; null when there's nothing to say there. `before` is the placement as this device held it when the change went. */
export type SaveResult = { saved: true; draft: DraftState; notice?: string; before?: PlacementView } | { saved: false; message: string | null };
/** A change, or one picked on its turn from the draft as it is then (Undo and Redo); null sends nothing. */
export type Pending = Change | ((held: DraftState | null) => Change | null);

export const refusalOf = (result: SaveResult) => (result.saved ? null : result.message);

const newer = (current: DraftState | null, next: DraftState) => (current && current.planogramVersion > next.planogramVersion ? current : next);
const NOTHING: SaveResult = { saved: false, message: null };

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
  const goneRef = useRef(onGone);

  useEffect(() => {
    goneRef.current = onGone;
  });

  const hasDraft = draft !== null;

  useEffect(() => {
    if (!hasDraft) return;
    // Focus and visibilitychange both fire on coming back: one reload at a time, and none while changes wait.
    function reload() {
      if (document.visibilityState !== "visible" || waiting.current > 0 || reloading.current) return;
      reloading.current = true;
      reloadDraftAction(fixtureId)
        .then((next) => {
          if (!next) return goneRef.current();
          held.current = newer(held.current, next);
          setDraft(held.current);
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

  function hold(next: DraftState) {
    held.current = newer(held.current, next);
    setDraft(held.current);
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
    try {
      const reply = await saveChangeAction(fixtureId, change);
      const next = reply.draft;
      if (next) hold(next);
      if (reply.status === "saved") {
        if (change.kind === "update") {
          const steps = own.current.get(change.id) ?? new Map<number, number>();
          own.current.set(change.id, steps.set(change.version, change.version + 1));
        }
        if (waiting.current === 1) setStatus({ kind: "saved" });
        const was = change.kind === "add" ? undefined : before?.placements.find((p) => p.id === change.id);
        // Folded product moved onto a frame rack hangs instead (frame racks spec §3); the builder says so, with its Undo.
        return { saved: true, draft: reply.draft, ...(reply.notice ? { notice: reply.notice } : {}), ...(was ? { before: was } : {}) };
      }
      if (!reply.draft) {
        // Published or discarded on another device: the page reloads to what's there now, and nothing queued is sent.
        round.current += 1;
        setStatus({ kind: "idle" });
        goneRef.current();
        return NOTHING;
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

  return { draft, status, save, adopt };
}
