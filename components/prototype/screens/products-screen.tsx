// Products after the Week 6.5 merge: one search box, the count, and
// location-first cards.

import { Check, Ellipsis, MapPin, Percent, Plus, Search, X } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

const CARDS = [
  { name: "High-Rise Pant", style: "HRP-01", where: "Wall bay 3 · Middle · 2–3 ft from left", status: "ok", tone: "bg-zone-2" },
  { name: "High-Rise Short", style: "HRS-04", where: "Table 1 · Front · ½–1½ ft from left", status: "sale", tone: "bg-zone-6" },
  { name: "Rise Wide-Leg Jean", style: "RWJ-02", where: "Not placed", status: "out", tone: "bg-zone-5" },
] as const;

const STATUS = {
  ok: { word: "In stock", icon: Check, look: "bg-ok-tint text-ok" },
  sale: { word: "On sale", icon: Percent, look: "bg-info-tint text-info" },
  out: { word: "Sold out", icon: X, look: "bg-danger-tint text-danger" },
};

export function ProductsScreen() {
  const actions = (
    <span className="flex items-center gap-1 text-ink">
      <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
      <Ellipsis aria-hidden="true" strokeWidth={1.75} className="size-5" />
      <Marker n={5} />
    </span>
  );

  return (
    <MockScreen title="Products" tab="products" actions={actions}>
      <span className="flex items-center gap-2">
        <span className="flex h-10 flex-1 items-center gap-2 rounded border border-line bg-raised px-3 text-sm text-ink">
          <Search aria-hidden="true" strokeWidth={1.75} className="size-4 text-ink-muted" />
          hi rise pnt
        </span>
        <Marker n={1} />
      </span>
      <span className="flex items-center justify-between text-xs text-ink-muted">
        30 of 47 products · Best match
        <Marker n={2} />
      </span>
      {CARDS.map((card, i) => {
        const { word, icon: Icon, look } = STATUS[card.status];
        return (
          <div key={card.name} className="flex gap-3 rounded-lg border border-line bg-raised p-2.5">
            <span aria-hidden="true" className={`size-14 shrink-0 rounded ${card.tone}`} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-1 text-xs text-ink">
                <MapPin aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
                <span className="truncate">{card.where}</span>
                {i === 0 ? <Marker n={3} /> : null}
              </span>
              <span className="text-sm font-medium text-ink">
                {card.name} <span className="font-mono text-xs font-normal text-ink-muted">{card.style}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${look}`}>
                  <Icon aria-hidden="true" strokeWidth={1.75} className="size-3" />
                  {word}
                </span>
                {i === 0 ? <Marker n={4} /> : null}
              </span>
            </span>
          </div>
        );
      })}
    </MockScreen>
  );
}
