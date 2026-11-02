// The chapter's numbered points. Each is a button: choosing one lights the
// matching dot on the screen drawing, and a dot lights its point here.

"use client";

import type { Point } from "@/lib/prototype/types";

import { usePoint } from "./point-context";

export function ChapterPoints({ points }: { points: Point[] }) {
  const { active, choose } = usePoint();

  return (
    <ol className="flex flex-col gap-1">
      {points.map((point, i) => {
        const n = i + 1;
        return (
          <li key={point.title}>
            <button
              type="button"
              aria-pressed={active === n}
              onClick={() => choose(n)}
              className="flex w-full gap-3 rounded-lg border border-transparent p-3 text-left hover:bg-line-subtle focus-visible:outline-2 focus-visible:outline-ink aria-pressed:border-brand aria-pressed:bg-raised"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium ${active === n ? "bg-brand text-on-brand" : "bg-ink text-surface"}`}
              >
                {n}
              </span>
              <span>
                <span className="block font-medium text-ink">{point.title}</span>
                <span className="block text-ink-muted">{point.text}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
