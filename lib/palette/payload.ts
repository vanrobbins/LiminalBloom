// What the two palette answers carry (spec §7): names, ids and a few words, trimmed in one
// place so nothing past `view` can leak by accident. No image paths, versions, category ids,
// dates or location detail. Pure.

import { planogramList, type ListItem, type PlanogramSummary } from "@/lib/planograms/list";
import type { Layout } from "@/lib/layout/types";
import { byName, typeHint } from "@/lib/natural-sort";
import type { SearchPage } from "@/lib/products/queries";

import type { PaletteIndex, PaletteProducts } from "./types";

/** The /planograms row's one state (planogram-list.tsx): the version, else Draft, else Not published. */
function stateOf(item: ListItem): string {
  if (item.publishedVersion && item.publishedAt) return `Version ${item.publishedVersion}`;
  return item.hasDraft ? "Draft" : "Not published";
}

export function toPaletteIndex(layout: Layout, summaries: readonly PlanogramSummary[]): PaletteIndex {
  return {
    planograms: planogramList(layout, summaries).flatMap((g) =>
      g.items.map((i) => ({ fixtureId: i.fixtureId, name: i.name, ...optional(typeHint(i.name, i.typeLabel)), zoneName: g.zoneName, state: stateOf(i) })),
    ),
    zones: byName(layout.zones).map((z) => ({
      id: z.id,
      name: z.name,
      // The properties panel's count: lower tables belong to their upper.
      fixtureCount: layout.fixtures.filter((f) => f.zoneId === z.id && f.tableSetId === null).length,
    })),
  };
}

const optional = (typeHint: string | undefined) => (typeHint === undefined ? {} : { typeHint });

export function toPaletteProducts(page: SearchPage): PaletteProducts {
  return {
    products: page.results.map((r) => ({
      id: r.id,
      name: r.name,
      styleNumber: r.styleNumber,
      status: r.status,
      place: r.locations[0]?.label ?? null,
      more: Math.max(0, r.locations.length - 1),
    })),
    total: page.total,
  };
}
