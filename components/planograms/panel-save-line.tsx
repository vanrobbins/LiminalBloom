// The product panel's own save line (0.7.0.5 spec §2.4): "Saving…", "Saved" or
// "Couldn't save", beside the fields that were edited, so a failure is never
// only in the far corner. It shares the corner indicator's calm timing (300 ms
// before Saving… shows, held 500 ms) but not its `data-draft-status` mark, which
// names the one indicator in the corner bar.

"use client";

import { AlertTriangle, Check, LoaderCircle } from "lucide-react";

import { useCalmStatus } from "./draft-status";
import type { DraftStatus } from "./use-planogram-draft";

export function PanelSaveLine({ status }: { status: DraftStatus }) {
  const { kind } = useCalmStatus(status);
  const text = kind === "saving" ? "Saving…" : kind === "saved" ? "Saved" : kind === "refused" ? "Couldn't save" : "";
  return (
    <p role="status" aria-live="polite" data-panel-status className={`flex min-h-6 items-center gap-1 text-sm ${kind === "refused" ? "text-danger" : "text-ink-muted"}`}>
      {/* Saving… is for the eye only, as in the corner: a screen reader hears the settled state. */}
      {/* "Couldn't save" is for the eye too: the reason is said once, on the draft's status line. */}
      <span key={kind} aria-hidden={kind === "saving" || kind === "refused" || undefined} className="inline-flex items-center gap-1 motion-safe:animate-fade-in">
        {kind === "refused" ? <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4" /> : null}
        {kind === "saved" ? <Check aria-hidden="true" strokeWidth={2} className="size-4" /> : null}
        {kind === "saving" ? <LoaderCircle aria-hidden="true" strokeWidth={1.75} className="size-4 motion-safe:animate-spin" /> : null}
        {text}
      </span>
    </p>
  );
}
