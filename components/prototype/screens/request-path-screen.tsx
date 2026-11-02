// How a request travels, top to bottom: device, three server checks, then
// the places data lives.

import { ArrowDown, Database, Server, Smartphone } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

const CHECKS = ["Who are you?", "Are you allowed?", "Is it valid?"];
const PLACES = ["Database", "Private files", "Store's AI"];

function Down() {
  return <ArrowDown aria-hidden="true" strokeWidth={1.75} className="mx-auto my-0.5 size-4 text-ink-muted" />;
}

export function RequestPathScreen() {
  return (
    <MockScreen title="How a request travels" tab="none">
      <span className="flex items-center gap-3 rounded-lg border border-line bg-raised p-3">
        <Smartphone aria-hidden="true" strokeWidth={1.75} className="size-5 text-ink" />
        <span className="flex-1 text-sm text-ink">The device</span>
        <Marker n={1} />
      </span>
      <Down />
      <section className="flex flex-col gap-2 rounded-lg border-2 border-ink bg-raised p-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Server aria-hidden="true" strokeWidth={1.75} className="size-5" />
          The server checks
        </span>
        {CHECKS.map((check, i) => (
          <span key={check} className="flex items-center gap-2 rounded bg-line-subtle px-3 py-2 text-xs text-ink">
            <span className="font-mono text-ink-muted">{i + 1}</span>
            <span className="flex-1">{check}</span>
            <Marker n={i + 2} />
          </span>
        ))}
      </section>
      <Down />
      <span className="flex items-center justify-between text-xs text-ink-muted">
        Only if all three pass <Marker n={5} />
      </span>
      <span className="grid grid-cols-3 gap-2">
        {PLACES.map((place) => (
          <span key={place} className="flex flex-col items-center gap-1 rounded-lg border border-line bg-raised p-2 text-center text-xs text-ink">
            <Database aria-hidden="true" strokeWidth={1.75} className="size-4 text-ink-muted" />
            {place}
          </span>
        ))}
      </span>
      <p className="mt-auto rounded-lg bg-line-subtle p-3 text-xs text-ink">
        Master key → store key → store secrets. One store&apos;s key opens nothing in another.
      </p>
    </MockScreen>
  );
}
