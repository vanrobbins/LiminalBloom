// One option in the palette's list (spec §3.1): a decorative icon, the words, a second line
// for what it is or where it is, and a status badge only for a product that isn't in stock.
// Presentation only: the list owns which row is active and what choosing one does.

import { History, LayoutPanelTop, MapIcon, Package, Search } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { PaletteItem } from "@/lib/palette/types";

const ICONS = { planogram: LayoutPanelTop, zone: MapIcon, product: Package, "all-products": Search, recent: History } as const;

function Second({ item }: { item: PaletteItem }) {
  if (item.kind === "product") {
    return (
      <span className="block truncate text-sm text-ink-muted">
        <span className="font-mono">{item.styleNumber}</span> · {item.place ?? "Not placed"}
        {item.more > 0 ? ` · +${item.more} more` : ""}
      </span>
    );
  }
  const text = item.kind === "planogram" || item.kind === "zone" || item.kind === "recent" ? item.second : undefined;
  return text ? <span className="block truncate text-sm text-ink-muted">{text}</span> : null;
}

type PaletteRowProps = { item: PaletteItem; id: string; active: boolean; onPick: (item: PaletteItem) => void; onHover: () => void };

export function PaletteRow({ item, id, active, onPick, onHover }: PaletteRowProps) {
  const Icon = item.kind === "page" || item.kind === "action" ? item.icon : ICONS[item.kind];
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-active={active ? "" : undefined}
      // Keeps focus in the field through the click, as the time zone search does.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(item)}
      onMouseMove={() => !active && onHover()}
      className="flex min-h-11 cursor-default items-center gap-3 rounded px-3 py-1.5 text-ink data-active:bg-line-subtle"
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{item.label}</span>
        <Second item={item} />
      </span>
      {item.kind === "product" && item.status !== "in_stock" ? <StatusBadge status={item.status} /> : null}
    </div>
  );
}
