// What the command palette lists (spec §3). Pure and client-safe: the groups, the
// two server answers, and the items a row is drawn from. No React, no database.

import type { LucideIcon } from "lucide-react";

import type { ProductStatus } from "@/lib/product-status";

export const GROUP_KEYS = ["recent", "planograms", "zones", "products", "goto", "actions"] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

/** `GET /api/palette`: what the browser matches itself. */
export type IndexPlanogram = { fixtureId: string; name: string; typeHint?: string; zoneName: string; state: string };
export type IndexZone = { id: string; name: string; fixtureCount: number };
export type PaletteIndex = { planograms: IndexPlanogram[]; zones: IndexZone[] };

/** `GET /api/palette/products?q=`: the top few, already trimmed. */
export type PaletteProduct = { id: string; name: string; styleNumber: string; status: ProductStatus; place: string | null; more: number };
export type PaletteProducts = { products: PaletteProduct[]; total: number };

/** What choosing a page or action does: go somewhere, or change something in place. */
export type Target = { href: string } | { theme: true } | { storeId: string };

/** What a recent pick can be: only things with an address (theme and store switches are not kept). */
export type RecentKind = "planogram" | "zone" | "product" | "page" | "action";
export type RecentPick = { id: string; kind: RecentKind; label: string; second?: string; href: string };

type Line = { id: string; label: string; keywords: string };

export type PaletteItem =
  | (Line & { kind: "planogram" | "zone"; second: string; href: string })
  | (Line & { kind: "product"; styleNumber: string; status: ProductStatus; place: string | null; more: number; href: string })
  | (Line & { kind: "all-products"; href: string })
  | (Line & { kind: "page" | "action"; icon: LucideIcon; target: Target })
  | (Line & { kind: "recent"; of: RecentKind; second?: string; href: string });

export type PaletteGroup = { key: GroupKey; heading: string; items: PaletteItem[] };
