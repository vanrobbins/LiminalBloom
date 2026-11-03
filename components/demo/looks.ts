// Class names the demo screens share, so a product's tint and a status's look
// are decided in one place. Zone tokens are muted fills ink reads on in both themes.

import { Check, Percent, X, type LucideIcon } from "lucide-react";

import type { Status } from "@/lib/demo/types";

export const TINT = ["bg-line-subtle", "bg-zone-1", "bg-zone-2", "bg-zone-3", "bg-zone-4", "bg-zone-5", "bg-zone-6", "bg-zone-7", "bg-zone-8"];

export const ZONE_FILL = ["fill-line-subtle", "fill-zone-1", "fill-zone-2", "fill-zone-3", "fill-zone-4", "fill-zone-5", "fill-zone-6", "fill-zone-7", "fill-zone-8"];

/** Status is a word and an icon, never colour alone, and never gold (§5.5). */
export const STATUS_LOOK: Record<Status, { word: string; icon: LucideIcon; tone: string }> = {
  in_stock: { word: "In stock", icon: Check, tone: "bg-ok-tint text-ok" },
  sold_out: { word: "Sold out", icon: X, tone: "bg-danger-tint text-danger" },
  on_sale: { word: "On sale", icon: Percent, tone: "bg-info-tint text-info" },
};

export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
