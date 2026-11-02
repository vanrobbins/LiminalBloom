// The store test sheet: each promise from the proposal and its target.

import { Timer } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

const CHECKS = [
  { what: "Find a product's spot", target: "under 10 s" },
  { what: "Sold out → published", target: "under 2 min" },
  { what: "New product placed", target: "under 2 min" },
  { what: "AA contrast · 44 px targets", target: "both themes" },
];

export function ChecklistScreen() {
  return (
    <MockScreen title="Store test" tab="none">
      <span className="text-xs text-ink-muted">Two team members · no help given</span>
      <ol className="flex flex-col gap-2">
        {CHECKS.map((check, i) => (
          <li key={check.what} className="flex items-center gap-3 rounded-lg border border-line bg-raised p-3">
            <Timer aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-muted" />
            <span className="flex-1">
              <span className="block text-sm font-medium text-ink">{check.what}</span>
              <span className="block text-xs text-ink-muted">Target: {check.target} · To measure</span>
            </span>
            <Marker n={i + 1} />
          </li>
        ))}
      </ol>
      <p className="mt-auto rounded-lg bg-line-subtle p-3 text-xs text-ink">
        Already automated: overlap and edge checks, three screen sizes, and store-to-store isolation.
      </p>
    </MockScreen>
  );
}
