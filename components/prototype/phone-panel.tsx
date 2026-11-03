// The phone beside a chapter, with an "Explained / Try it" switch. Explained
// shows the drawing with numbered points; Try it runs the demo app on that
// chapter's screen. The choice carries across chapters, and so does the demo
// store, so what you change in one chapter is still changed in the next.

"use client";

import { Check } from "lucide-react";

import type { Chapter } from "@/lib/prototype/types";

import { DemoApp } from "../demo/demo-app";
import { ChapterScreen } from "./chapter-screen";
import { PhoneFrame } from "./phone-frame";

export type PhoneMode = "explained" | "try";

const MODES: { value: PhoneMode; label: string }[] = [
  { value: "explained", label: "Explained" },
  { value: "try", label: "Try it" },
];

export function PhonePanel({ chapter, mode, onMode }: { chapter: Chapter; mode: PhoneMode; onMode: (mode: PhoneMode) => void }) {
  const isLive = mode === "try" && chapter.live;

  return (
    <div className="flex flex-col items-center gap-3">
      <div role="radiogroup" aria-label="Phone shows" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => onMode(value)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-4 text-sm text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-checked:bg-brand aria-checked:font-semibold aria-checked:text-on-brand"
          >
            {mode === value ? <Check aria-hidden="true" strokeWidth={2} className="size-4" /> : null}
            {label}
          </button>
        ))}
      </div>
      {isLive && chapter.live ? (
        <PhoneFrame label={`Working demo: ${chapter.title}`} caption="The working demo, with made-up data. Everything you change stays until you reload.">
          {/* Keyed by chapter, so each chapter opens on its own screen. */}
          <DemoApp key={chapter.id} start={chapter.live.start} startSheet={chapter.live.sheet ?? null} />
        </PhoneFrame>
      ) : (
        <PhoneFrame
          label={`Drawing of the ${chapter.title} screen`}
          caption={mode === "try" ? "This screen is a drawing only; it isn't in the demo yet." : "A drawing of the screen. Tap a number."}
        >
          <ChapterScreen id={chapter.screen} />
        </PhoneFrame>
      )}
    </div>
  );
}
