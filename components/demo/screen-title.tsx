// A demo screen's title row: an optional back button, the title, a line
// under it, and actions on the right.

"use client";

import { ChevronLeft } from "lucide-react";

import { FOCUS } from "./looks";

type ScreenTitleProps = { title: string; sub?: string; onBack?: () => void; backLabel?: string; children?: React.ReactNode };

export function ScreenTitle({ title, sub, onBack, backLabel = "Back", children }: ScreenTitleProps) {
  return (
    <div className="flex items-start gap-2">
      {onBack ? (
        <button type="button" aria-label={backLabel} onClick={onBack} className={`-ml-2 flex size-11 shrink-0 items-center justify-center rounded ${FOCUS}`}>
          <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-6" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {sub ? <p className="text-sm text-ink-muted">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}
