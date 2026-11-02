// Store settings' AI connection (if time allows): provider,
// masked key, usage, and a disabled AI button elsewhere until it's connected.

import { KeyRound, Lock, Sparkles } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

function Pick({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      <span className="flex h-10 items-center rounded border border-line bg-surface px-3 text-sm text-ink">{value}</span>
    </span>
  );
}

export function AiConnectionScreen() {
  return (
    <MockScreen title="Store settings" tab="account">
      <section className="flex flex-col gap-2.5 rounded-lg border border-line bg-raised p-3">
        <span className="flex items-center justify-between text-sm font-semibold text-ink">
          AI connection <Marker n={1} />
        </span>
        <Pick label="Provider" value="The store's own provider" />
        <Pick label="Model" value="Chosen from the provider's list" />
        <span className="flex items-center gap-2 text-sm text-ink">
          <KeyRound aria-hidden="true" strokeWidth={1.75} className="size-4 text-ink-muted" />
          <span className="flex-1 font-mono">•••• •••• 7f3a</span>
          <Marker n={2} />
        </span>
        <span className="flex gap-2 text-sm">
          <span className="flex h-10 flex-1 items-center justify-center rounded border border-line text-ink">Replace</span>
          <span className="flex h-10 flex-1 items-center justify-center rounded border border-line text-ink">Remove</span>
        </span>
      </section>
      <section className="flex items-center justify-between rounded-lg border border-line bg-raised p-3 text-xs text-ink">
        <span>
          <span className="block font-semibold">Usage</span>
          12 requests this week · 41 this month
        </span>
        <Marker n={3} />
      </section>
      <section className="mt-auto flex flex-col gap-2 rounded-lg border border-dashed border-line p-3 text-xs text-ink-muted">
        <span className="flex items-center gap-2">
          <span className="flex h-10 flex-1 items-center justify-center gap-2 rounded border border-line text-sm opacity-60">
            <Sparkles aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Auto-Build
          </span>
          <Marker n={4} />
        </span>
        <span className="flex items-center gap-1">
          <Lock aria-hidden="true" strokeWidth={1.75} className="size-3" />
          In a store with no connection: “An Admin can connect AI in Store settings.”
        </span>
      </section>
    </MockScreen>
  );
}
