// A sold-out or on-sale mark on a tile of the Published view (0.7.0.9 spec §5.2): an icon badge in the corner, an outline,
// and the status in the tile's name, so it never rests on colour alone. The monthly draft's tiles carry no status.

import { Percent, X } from "lucide-react";

import type { ProductStatus } from "@/lib/product-status";

import type { GridItem } from "./grid-items";

type Marked = Extract<ProductStatus, "sold_out" | "on_sale">;

export const STATUS_WORD: Record<Marked, string> = { sold_out: "sold out", on_sale: "on sale" };

/** The mark a tile shows, or null (in stock, no status, or a draft tile). */
export const markOf = (item: Pick<GridItem, "status">): Marked | null => (item.status === "sold_out" || item.status === "on_sale" ? item.status : null);

/** Bottom-left: the count badge is top-right and an issue's triangle top-left. */
export function TileStatusBadge({ mark }: { mark: Marked }) {
  const Icon = mark === "sold_out" ? X : Percent;
  return (
    <span
      aria-hidden="true"
      data-status-badge={mark}
      className={`pointer-events-none absolute bottom-1 left-1 inline-flex size-5 items-center justify-center rounded-full ${mark === "sold_out" ? "bg-danger-tint text-danger" : "bg-info-tint text-info"}`}
    >
      <Icon strokeWidth={2} className="size-3" />
    </span>
  );
}
