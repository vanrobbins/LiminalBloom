// The Week 8 review queue: waiting work, one opened with its actions,
// print and share, and the display's price averages.

import { Printer, Share2 } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

const WAITING = [
  { what: "Wall bay 3 · Quick Adjust", who: "Jordan · 25 min ago" },
  { what: "Frame run A · Draft", who: "Alex · yesterday" },
];

export function ReviewScreen() {
  return (
    <MockScreen title="Review queue" tab="home">
      <span className="flex items-center justify-between text-xs text-ink-muted">
        3 waiting · oldest first <Marker n={1} />
      </span>
      <section className="flex flex-col gap-2 rounded-lg border border-brand bg-raised p-3">
        <span className="text-sm font-semibold text-ink">Table 1 · Fall front table</span>
        <span className="text-xs text-ink-muted">Draft from Sam · 6 changes · due tomorrow</span>
        <span className="flex items-center gap-2">
          <span className="flex h-10 flex-1 items-center justify-center rounded bg-brand text-sm font-medium text-on-brand">Approve</span>
          <span className="flex h-10 flex-1 items-center justify-center rounded border border-line text-sm text-ink">Ask for changes</span>
          <Marker n={2} />
        </span>
      </section>
      {WAITING.map((item) => (
        <span key={item.what} className="flex flex-col rounded-lg border border-line bg-raised p-3">
          <span className="text-sm font-medium text-ink">{item.what}</span>
          <span className="text-xs text-ink-muted">{item.who}</span>
        </span>
      ))}
      <section className="mt-auto flex flex-col gap-2 rounded-lg border border-line bg-raised p-3 text-xs">
        <span className="flex items-center justify-between text-ink">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Printer aria-hidden="true" strokeWidth={1.75} className="size-4" />Print</span>
            <span className="flex items-center gap-1"><Share2 aria-hidden="true" strokeWidth={1.75} className="size-4" />Share link</span>
          </span>
          <Marker n={3} />
        </span>
        <span className="flex items-center justify-between border-t border-line-subtle pt-2 text-ink">
          <span>
            Average price <span className="font-mono">$48</span> · by space <span className="font-mono">$52</span>
          </span>
          <Marker n={4} />
        </span>
      </section>
    </MockScreen>
  );
}
