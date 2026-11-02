// A VM Lead's Home: what's due, what's in progress, and what's sold out
// but still taking space on a display.

import { Calendar, PencilLine, X } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

function Card({ title, n, children }: { title: string; n: number; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-raised p-3">
      <span className="mb-1.5 flex items-center justify-between text-sm font-semibold text-ink">
        {title} <Marker n={n} />
      </span>
      <div className="flex flex-col gap-1.5 text-xs">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, main, side }: { icon: typeof Calendar; main: string; side: string }) {
  return (
    <span className="flex items-center gap-2 text-ink">
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0 text-ink-muted" />
      <span className="flex-1 truncate">{main}</span>
      <span className="text-ink-muted">{side}</span>
    </span>
  );
}

export function HomeScreen() {
  return (
    <MockScreen tab="home" tabMarker={5}>
      <div className="mt-2 flex items-start justify-between">
        <span>
          <span className="block text-xl font-semibold tracking-tight text-ink">Good morning, Sam</span>
          <span className="block text-xs text-ink-muted">VM Lead · Monday, November 2</span>
        </span>
        <Marker n={1} />
      </div>
      <Card title="Due soon" n={2}>
        <Row icon={Calendar} main="Front table · Fall story" side="Tomorrow" />
        <Row icon={Calendar} main="Fitting room rack · Knit story" side="Nov 14" />
      </Card>
      <Card title="Drafts in progress" n={3}>
        <Row icon={PencilLine} main="Denim wall · 4 changes" side="Jordan, 2 h ago" />
        <Row icon={PencilLine} main="Back wall run · 1 change" side="You, yesterday" />
      </Card>
      <Card title="Sold out, still on display" n={4}>
        <span className="flex items-center gap-2 text-ink">
          <span className="inline-flex items-center gap-1 rounded-full bg-danger-tint px-2 py-0.5 font-medium text-danger">
            <X aria-hidden="true" strokeWidth={1.75} className="size-3" />
            Sold out
          </span>
          <span className="flex-1 truncate">Straight jean · 3 displays</span>
        </span>
      </Card>
    </MockScreen>
  );
}
