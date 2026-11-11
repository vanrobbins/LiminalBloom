// A part of a panel folded behind its title (DECISIONS 11-11): one line that
// says what is inside and what it is set to now, opened with a tap. The
// header is a button with aria-expanded, like ZoneFold's.

"use client";

import { ChevronRight } from "lucide-react";
import { useId } from "react";

type FoldProps = {
  title: string;
  /** What the folded part is set to, e.g. "Straight" or "4 ft × 5 rows". */
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function Fold({ title, summary, open, onToggle, children }: FoldProps) {
  const id = useId();
  return (
    <section className="flex flex-col border-y border-line-subtle">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center gap-2 rounded text-left text-sm focus-visible:outline-2 focus-visible:outline-ink"
        >
          <ChevronRight aria-hidden="true" strokeWidth={1.75} className={`size-4 shrink-0 text-ink-muted motion-safe:transition-transform ${open ? "rotate-90" : ""}`} />
          {/* The space keeps the two apart in the button's name: "Curve Straight". */}
          <span className="shrink-0 font-medium text-ink">{title}</span>{" "}
          {summary ? <span className="min-w-0 flex-1 truncate text-right text-ink-muted">{summary}</span> : null}
        </button>
      </h3>
      {open ? (
        <div id={`${id}-body`} className="flex flex-col gap-3 pt-1 pb-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
