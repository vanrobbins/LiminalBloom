// "Saving…" / "Saved" / why a change was refused, announced politely.

import { AlertTriangle } from "lucide-react";

import type { DraftStatus } from "./use-planogram-draft";

export function DraftStatusLine({ status }: { status: DraftStatus }) {
  const text = status.kind === "saving" ? "Saving…" : status.kind === "saved" ? "Saved" : status.kind === "refused" ? status.message : "";
  return (
    <p role="status" aria-live="polite" className={`flex min-h-6 items-center gap-1 text-sm ${status.kind === "refused" ? "text-danger" : "text-ink-muted"}`}>
      {status.kind === "refused" ? <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4" /> : null}
      {text}
    </p>
  );
}
