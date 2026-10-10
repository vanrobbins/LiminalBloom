// The draft as this device holds it (spec §4.3, co-editing). One change in
// flight at a time; every reply carries the whole draft, so the other device's
// edits arrive with each save, and coming back to the tab reloads it. A reply
// older than the draft already held (a slow reload) is dropped.

"use client";

import { useEffect, useRef, useState } from "react";

import { reloadDraftAction, saveChangeAction } from "@/app/(app)/planograms/actions";
import type { Change, DraftState } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

export type DraftStatus = { kind: "idle" | "saving" | "saved" } | { kind: "refused"; message: string };
/** A refusal's words go to the form that sent it; null when there's nothing to say there. */
export type SaveResult = { saved: true } | { saved: false; message: string | null };

export const refusalOf = (result: SaveResult) => (result.saved ? null : result.message);

const newer = (current: DraftState | null, next: DraftState) => (current && current.planogramVersion > next.planogramVersion ? current : next);

export function usePlanogramDraft(fixtureId: string, initial: DraftState | null, onGone: () => void) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<DraftStatus>({ kind: "idle" });
  const inFlight = useRef(false);
  const reloading = useRef(false);
  const goneRef = useRef(onGone);

  useEffect(() => {
    goneRef.current = onGone;
  });

  useEffect(() => {
    if (!initial) return;
    // Focus and visibilitychange both fire on coming back: one reload at a time.
    function reload() {
      if (document.visibilityState !== "visible" || inFlight.current || reloading.current) return;
      reloading.current = true;
      reloadDraftAction(fixtureId)
        .then((next) => (next ? setDraft((current) => newer(current, next)) : goneRef.current()))
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
  }, [fixtureId, initial]);

  async function save(change: Change): Promise<SaveResult> {
    if (inFlight.current) return { saved: false, message: null };
    inFlight.current = true;
    setStatus({ kind: "saving" });
    try {
      const reply = await saveChangeAction(fixtureId, change);
      const next = reply.draft;
      if (next) setDraft((current) => newer(current, next));
      if (reply.status === "saved") {
        setStatus({ kind: "saved" });
        return { saved: true };
      }
      if (!reply.draft) {
        // Published or discarded on another device: the page reloads to what's there now.
        setStatus({ kind: "idle" });
        goneRef.current();
        return { saved: false, message: null };
      }
      setStatus({ kind: "refused", message: reply.message });
      return { saved: false, message: reply.message };
    } catch {
      setStatus({ kind: "idle" });
      toast({ tone: "error", title: "Couldn't save", description: "Check the connection and try again." });
      return { saved: false, message: null };
    } finally {
      inFlight.current = false;
    }
  }

  return { draft, status, save };
}
