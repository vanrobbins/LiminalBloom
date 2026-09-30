// How each product status reads on screen: a word, an icon, and a tone.
// Status is never color alone, and never gold (§5.5), so the tone type has
// no way to say "brand".

import { Check, Percent, X, type LucideIcon } from "lucide-react";

import type { products } from "@/db/schema";

export type ProductStatus = (typeof products.$inferSelect)["status"];

export type StatusTone = "ok" | "danger" | "info";

export const PRODUCT_STATUS: Record<
  ProductStatus,
  { label: string; icon: LucideIcon; tone: StatusTone }
> = {
  in_stock: { label: "In stock", icon: Check, tone: "ok" },
  sold_out: { label: "Sold out", icon: X, tone: "danger" },
  on_sale: { label: "On sale", icon: Percent, tone: "info" },
};
