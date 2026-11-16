// Saved / Saving… / Offline, retrying (spec §9), announced politely. A refusal (0.7.0.5 spec 3.1)
// takes the label's place: what the editor couldn't do, in words with an alert icon.

import { AlertTriangle, CloudOff } from "lucide-react";

import type { SaveStatus as Status } from "./use-map-editor";

const LABEL: Record<Status, string> = { saved: "Saved", saving: "Saving…", offline: "Offline, retrying" };

export function SaveStatus({ status, refusal = null }: { status: Status; refusal?: string | null }) {
  return (
    <p role="status" aria-live="polite" className={`flex items-center gap-1 text-sm ${refusal || status === "offline" ? "text-danger" : "text-ink-muted"}`}>
      {refusal ? <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" /> : status === "offline" ? <CloudOff aria-hidden="true" strokeWidth={1.75} className="size-4" /> : null}
      {refusal ?? LABEL[status]}
    </p>
  );
}
