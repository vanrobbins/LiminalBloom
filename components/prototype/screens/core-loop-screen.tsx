// The core loop as four cards, top to bottom, each with its point.

import { ArrowDown } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

const STEPS = [
  { title: "Stock changes", line: "Straight jean · Sold out" },
  { title: "The app flags the gaps", line: "3 displays · 4 ft of open rail" },
  { title: "The team adjusts", line: "Wide-leg jean fits · moved on a phone" },
  { title: "Everyone sees it", line: "Search shows the new spot at once" },
];

export function CoreLoopScreen() {
  return (
    <MockScreen tab="none">
      <div className="mt-6 mb-2 flex items-center gap-2">
        <span aria-hidden="true" className="size-5 rounded-full bg-brand" />
        <span className="text-lg font-semibold tracking-tight text-ink">Liminal Bloom</span>
      </div>
      <p className="text-sm text-ink-muted">The core loop. It repeats every time stock changes between monthly planograms.</p>
      <ol className="mt-2 flex flex-col items-stretch">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col items-center">
            <div className="flex w-full items-center gap-3 rounded-lg border border-line bg-raised p-3">
              <span className="font-mono text-sm text-ink-muted">0{i + 1}</span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-ink">{step.title}</span>
                <span className="block text-xs text-ink-muted">{step.line}</span>
              </span>
              <Marker n={i + 1} />
            </div>
            {i < STEPS.length - 1 ? (
              <ArrowDown aria-hidden="true" strokeWidth={1.75} className="my-1 size-4 text-ink-muted" />
            ) : null}
          </li>
        ))}
      </ol>
    </MockScreen>
  );
}
