// The marks on a tile (0.7.0.9 spec §5.2): sold out and on sale on the Published view, and on the Quick Adjust page also
// replaced and left empty. An icon badge in the corner, an outline, and the status in the tile's name, so it never rests on
// colour alone. The monthly draft's tiles carry none.

import { ArrowLeftRight, Layers, Percent, Shirt, SquareDashed, X } from "lucide-react";

import { PRESENTATION_LABEL } from "@/lib/products/footprint";

import type { GridItem } from "./grid-items";

type Mark = "sold_out" | "on_sale" | "replaced" | "empty" | "changed";

export const STATUS_WORD: Record<Mark, string> = { sold_out: "sold out", on_sale: "on sale", replaced: "replaced", empty: "left empty", changed: "will change" };

/** The mark a tile shows, or null (in stock, no status, or a draft tile). A Quick Adjust change beats the product's own status. */
export const markOf = (item: Pick<GridItem, "status" | "adjust">): Mark | null =>
  item.adjust ? item.adjust.kind : item.status === "sold_out" || item.status === "on_sale" ? item.status : null;

/** What the tile is called: "Pant, sold out", "Slim jean, replaces Straight jean", "Empty, was Straight jean". */
export function tileName(item: Pick<GridItem, "productName" | "adjust">, mark: Mark | null): string {
  if (item.adjust?.kind === "replaced") return `${item.productName}, replaces ${item.adjust.from}`;
  if (item.adjust?.kind === "empty") return `Empty, was ${item.adjust.was}`;
  return mark ? `${item.productName}, ${STATUS_WORD[mark]}` : item.productName;
}

const BADGE: Record<Mark, { Icon: typeof X; tone: string }> = {
  sold_out: { Icon: X, tone: "bg-danger-tint text-danger" },
  on_sale: { Icon: Percent, tone: "bg-info-tint text-info" },
  replaced: { Icon: ArrowLeftRight, tone: "bg-raised text-ink" },
  empty: { Icon: SquareDashed, tone: "bg-raised text-ink-muted" },
  changed: { Icon: ArrowLeftRight, tone: "bg-raised text-ink" },
};

/** Bottom-left: the count badge is top-right and an issue's triangle top-left. */
export function TileStatusBadge({ mark }: { mark: Mark }) {
  const { Icon, tone } = BADGE[mark];
  return (
    <span aria-hidden="true" data-status-badge={mark} className={`pointer-events-none absolute bottom-1 left-1 inline-flex size-5 items-center justify-center rounded-full ${tone}`}>
      <Icon strokeWidth={2} className="size-3" />
    </span>
  );
}

/** An icon for hung or folded and the piece count, not "F 1" (UX audit U21); the words are in the label and on hover. A tile left empty has no pieces. */
export function TileCount({ item }: { item: Pick<GridItem, "presentation" | "pieceCount" | "adjust"> }) {
  if (item.adjust?.kind === "empty") return null;
  return (
    <span
      aria-hidden="true"
      data-count-badge
      title={`${PRESENTATION_LABEL[item.presentation]} · ${item.pieceCount} ${item.pieceCount === 1 ? "piece" : "pieces"}`}
      className="pointer-events-auto absolute top-1 right-1 inline-flex items-center gap-0.5 rounded bg-raised/90 px-1 text-xs text-ink"
    >
      {item.presentation === "hung" ? <Shirt strokeWidth={1.75} className="size-3" /> : <Layers strokeWidth={1.75} className="size-3" />}
      {item.pieceCount}
    </span>
  );
}
