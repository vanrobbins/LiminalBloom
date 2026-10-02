// Saved / Saving… / Offline, retrying (spec §9), announced politely.

import { CloudOff } from "lucide-react";

import type { SaveStatus as Status } from "./use-map-editor";

const LABEL: Record<Status, string> = { saved: "Saved", saving: "Saving…", offline: "Offline, retrying" };

export function SaveStatus({ status }: { status: Status }) {
  return (
    <p role="status" aria-live="polite" className={`flex items-center gap-1 text-sm ${status === "offline" ? "text-danger" : "text-ink-muted"}`}>
      {status === "offline" ? <CloudOff aria-hidden="true" strokeWidth={1.75} className="size-4" /> : null}
      {LABEL[status]}
    </p>
  );
}
