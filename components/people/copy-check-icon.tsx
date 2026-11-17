// The copy icon that swaps to a check for a moment once the link is copied: one
// slot, two icons trading opacity (0.7.0.5 spec §3.1). Shared by the invitations
// card and the invite dialog.

import { Check, Copy } from "lucide-react";

const FADE = "motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-[var(--ease-enter)]";

export function CopyCheckIcon({ copied }: { copied: boolean }) {
  return (
    <span className="relative size-5">
      <Copy aria-hidden="true" strokeWidth={1.75} className={`absolute inset-0 size-5 ${FADE} ${copied ? "opacity-0" : "opacity-100"}`} />
      <Check data-copied aria-hidden="true" strokeWidth={2} className={`absolute inset-0 size-5 ${FADE} ${copied ? "opacity-100" : "opacity-0"}`} />
    </span>
  );
}
