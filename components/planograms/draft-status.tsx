// The draft's save state (0.7.0.5 spec §2.1). SaveIndicator is the corner bar's
// status: a check or an alert, the words on tablet and up and for screen
// readers only on a phone; "Saving…" shows after 300 ms and, once shown, holds
// 500 ms so a quick save never flashes and a slow one never blinks away
// (Doherty). DraftStatusLine says why a change was refused, or a note that came with a save, in full, below.

"use client";

import { AlertTriangle, Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { DraftStatus } from "./use-planogram-draft";

const SHOW_AFTER_MS = 300;
const HOLD_MS = 500;

/** The status to show: Saving… waits SHOW_AFTER_MS to appear and stays HOLD_MS once it has. */
export function useCalmStatus(status: DraftStatus): DraftStatus {
  const [shown, setShown] = useState<DraftStatus>(status.kind === "saving" ? { kind: "idle" } : status);
  const since = useRef<number | null>(null);
  const message = status.kind === "refused" ? status.message : "";
  useEffect(() => {
    if (status.kind === "saving") {
      // A save that starts while Saving… shows keeps it up, and its own Saved holds from now.
      if (shown.kind === "saving") {
        since.current = Date.now();
        return;
      }
      const timer = setTimeout(() => {
        since.current = Date.now();
        setShown({ kind: "saving" });
      }, SHOW_AFTER_MS);
      return () => clearTimeout(timer);
    }
    const wait = shown.kind === "saving" && since.current !== null ? Math.max(0, since.current + HOLD_MS - Date.now()) : 0;
    if (wait === 0) {
      setShown(status);
      return;
    }
    const timer = setTimeout(() => setShown(status), wait);
    return () => clearTimeout(timer);
    // The kind and the words are the status: a new object with the same ones is the same state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.kind, message]);
  return shown;
}

export function SaveIndicator({ status }: { status: DraftStatus }) {
  const { kind } = useCalmStatus(status);
  const text = kind === "saving" ? "Saving…" : kind === "saved" ? "Saved" : "";
  return (
    <p role="status" aria-live="polite" data-draft-status className={`flex size-6 shrink-0 items-center justify-center gap-1 text-sm sm:size-auto sm:min-w-20 sm:justify-end ${kind === "refused" ? "text-danger" : "text-ink-muted"}`}>
      {/* Saving… is for the eye only: a screen reader hears the settled state, not "Saving…" then "Saved" on every edit. */}
      <span key={kind} aria-hidden={kind === "saving" || undefined} className="inline-flex items-center gap-1 motion-safe:animate-fade-in">
        {kind === "refused" ? <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4" /> : null}
        {kind === "saved" ? <Check aria-hidden="true" strokeWidth={2} className="size-4" /> : null}
        {kind === "saving" ? <LoaderCircle aria-hidden="true" strokeWidth={1.75} className="size-4 motion-safe:animate-spin" /> : null}
        {text ? <span className="sr-only sm:not-sr-only">{text}</span> : null}
      </span>
    </p>
  );
}

/** Why a change was refused, or a note that came with a save. Always mounted, so what arrives is announced. */
export function DraftStatusLine({ status }: { status: DraftStatus }) {
  const refused = status.kind === "refused";
  const words = refused ? status.message : status.kind === "saved" ? status.note : undefined;
  return (
    <p role="status" aria-live="polite" data-draft-refusal data-draft-note={status.kind === "saved" && words ? "" : undefined} className={words ? `flex min-h-6 items-center gap-1 text-sm ${refused ? "text-danger" : "text-ink-muted"}` : "sr-only"}>
      {words ?? null}
    </p>
  );
}
