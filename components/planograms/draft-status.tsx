// "Saving…" / "Saved" / why a change was refused, announced politely. Each
// new state fades in; "Saved" carries a check, a refusal an alert icon.

import { AlertTriangle, Check } from "lucide-react";

import type { DraftStatus } from "./use-planogram-draft";

export function DraftStatusLine({ status }: { status: DraftStatus }) {
  const text = status.kind === "saving" ? "Saving…" : status.kind === "saved" ? "Saved" : status.kind === "refused" ? status.message : "";
  return (
    <p role="status" aria-live="polite" className={`flex min-h-6 items-center gap-1 text-sm ${status.kind === "refused" ? "text-danger" : "text-ink-muted"}`}>
      <span key={status.kind} className="inline-flex items-center gap-1 motion-safe:animate-fade-in">
        {status.kind === "refused" ? <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4" /> : null}
        {status.kind === "saved" ? <Check aria-hidden="true" strokeWidth={2} className="size-4" /> : null}
        {text}
      </span>
    </p>
  );
}
