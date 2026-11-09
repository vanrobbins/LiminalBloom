// One zone's group in a list, folded behind an arrow (DECISIONS 11-09, A1).
// Shared by the map's "Everything on the map" and /planograms so every zone
// grouping looks and works alike. The header is a button with aria-expanded;
// `action` sits beside it (the map's "Show on map").

"use client";

import { ChevronRight } from "lucide-react";
import { useId } from "react";

type ZoneFoldProps = {
  title: string;
  count: number;
  /** One line under the title, e.g. "2 drafts · 1 overdue". */
  summary?: React.ReactNode;
  open: boolean;
  /** False when there's nothing to fold away (a lone group): the arrow is hidden. */
  canFold?: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  as?: "h2" | "h3";
  children: React.ReactNode;
};

export function ZoneFold({ title, count, summary, open, canFold = true, onToggle, action, as: Heading = "h2", children }: ZoneFoldProps) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Heading className="min-w-0 flex-1">
          {canFold ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`${id}-body`}
              onClick={onToggle}
              className="flex min-h-11 w-full items-center gap-2 rounded px-2 text-left focus-visible:outline-2 focus-visible:outline-ink"
            >
              <ChevronRight aria-hidden="true" strokeWidth={1.75} className={`size-4 shrink-0 text-ink-muted motion-safe:transition-transform ${open ? "rotate-90" : ""}`} />
              <span id={`${id}-title`} className="min-w-0 font-medium text-ink wrap-anywhere">
                {title}
              </span>
              <span className="shrink-0 text-sm text-ink-muted">{count}</span>
            </button>
          ) : (
            <span className="flex min-h-11 items-center gap-2 px-2">
              <span id={`${id}-title`} className="min-w-0 font-medium text-ink wrap-anywhere">
                {title}
              </span>
              <span className="shrink-0 text-sm text-ink-muted">{count}</span>
            </span>
          )}
        </Heading>
        {action}
      </div>
      {summary ? <p className={`text-sm text-ink-muted ${canFold ? "pl-8" : "pl-2"}`}>{summary}</p> : null}
      {open ? <div id={`${id}-body`}>{children}</div> : null}
    </section>
  );
}
