// The palette's lists, in order (spec §3.1). The groups the browser matches itself come first
// and products, which arrive later, are appended below them, so a late answer never moves what
// is under the highlight. `keepActive` pins the highlight by id for the same reason.

import { byName } from "@/lib/natural-sort";
import { isTextQuery, normalizeQuery } from "@/lib/products/search-params";

import { matchAndSort } from "./match";
import { RECENT_MAX } from "./recent";
import type { GroupKey, PaletteGroup, PaletteIndex, PaletteItem, PaletteProducts, RecentPick } from "./types";

export const ALL_PRODUCTS_ID = "all-products";
export const CAPS = { planograms: 5, zones: 3, products: 5, adjust: 5 } as const;
const HEADINGS: Record<GroupKey, string> = { recent: "Recent", planograms: "Planograms", zones: "Zones", products: "Products", goto: "Go to", actions: "Actions" };

const group = (key: GroupKey, items: PaletteItem[]): PaletteGroup[] => (items.length > 0 ? [{ key, heading: HEADINGS[key], items }] : []);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function recentItems(recent: readonly RecentPick[], commands: readonly PaletteItem[]): PaletteItem[] {
  // A page or action is only kept while the person still has it (roles change); the rest are addresses.
  const have = new Set(commands.map((c) => c.id));
  return recent
    .filter((p) => (p.kind !== "page" && p.kind !== "action") || have.has(p.id))
    .slice(0, RECENT_MAX)
    .map((p) => ({ kind: "recent", id: `recent:${p.id}`, label: p.label, keywords: "", of: p.kind, second: p.second, href: p.href }));
}

function productItems(q: string, found: PaletteProducts | null): PaletteItem[] {
  const base = new URLSearchParams({ q });
  const total = found?.total ?? 0;
  const rows = (found?.products ?? []).slice(0, CAPS.products).map((p): PaletteItem => ({
    kind: "product",
    id: `product:${p.id}`,
    label: p.name,
    keywords: "",
    styleNumber: p.styleNumber,
    status: p.status,
    place: p.place,
    more: p.more,
    href: `/products?${new URLSearchParams({ q, open: p.id })}`,
  }));
  const all: PaletteItem = {
    kind: "all-products",
    id: ALL_PRODUCTS_ID,
    label: total > 0 ? `All ${total.toLocaleString("en-US")} products matching "${q}"` : `All products matching "${q}"`,
    keywords: "",
    href: `/products?${base}`,
  };
  return [...rows, all];
}

/** `query` as typed; `index` and `products` are null until their answers arrive. `adjust` (adjustCommands) joins Actions only while something is typed, after the plain ones, at most 5. */
export function paletteGroups(
  query: string,
  commands: readonly PaletteItem[],
  index: PaletteIndex | null,
  products: PaletteProducts | null,
  recent: readonly RecentPick[],
  adjust: readonly PaletteItem[] = [],
): PaletteGroup[] {
  const q = normalizeQuery(query);
  const pages = commands.filter((c) => c.kind === "page");
  const actions = commands.filter((c) => c.kind === "action");
  if (q === "") return [...group("recent", recentItems(recent, commands)), ...group("goto", pages), ...group("actions", actions)];

  const planograms = (index?.planograms ?? []).map((p): PaletteItem => ({
    kind: "planogram",
    id: `planogram:${p.fixtureId}`,
    label: p.name,
    keywords: `${p.typeHint ?? ""} ${p.zoneName}`,
    second: `${p.zoneName} · ${p.state}`,
    href: `/planograms/${p.fixtureId}`,
  }));
  const zones = byName(index?.zones ?? []).map((z): PaletteItem => ({
    kind: "zone",
    id: `zone:${z.id}`,
    label: z.name,
    keywords: "",
    second: `Zone · ${plural(z.fixtureCount, "fixture", "fixtures")}`,
    href: `/layout?zone=${z.id}`,
  }));
  return [
    ...group("planograms", matchAndSort(planograms, q).slice(0, CAPS.planograms)),
    ...group("zones", matchAndSort(zones, q).slice(0, CAPS.zones)),
    ...group("products", isTextQuery(q) ? productItems(query.trim().replace(/\s+/g, " "), products) : []),
    ...group("goto", matchAndSort(pages, q)),
    ...group("actions", [...matchAndSort(actions, q), ...matchAndSort(adjust, q).slice(0, CAPS.adjust)]),
  ];
}

/**
 * The highlighted option after the list changed: the same id if it is still there, else the first, else none.
 * "All products matching" is the first row of the Products group but never what Enter should mean by default
 * (typing "store" wants the Store page), so the fallback skips it unless it is all there is.
 */
export function keepActive(previousId: string | null, options: readonly { id: string }[]): string | null {
  if (previousId !== null && options.some((o) => o.id === previousId)) return previousId;
  return (options.find((o) => o.id !== ALL_PRODUCTS_ID) ?? options[0])?.id ?? null;
}

const count = (groups: readonly PaletteGroup[], key: GroupKey) => groups.find((g) => g.key === key)?.items.filter((i) => i.kind !== "all-products").length ?? 0;

/** What a screen reader hears once the answer settles: "2 planograms, 1 zone, 5 products", or that nothing matched. */
export function describeResults(groups: readonly PaletteGroup[], query: string): string {
  const pages = count(groups, "goto") + count(groups, "actions");
  const parts = [
    [count(groups, "planograms"), "planogram", "planograms"],
    [count(groups, "zones"), "zone", "zones"],
    [count(groups, "products"), "product", "products"],
    [pages, "page or action", "pages and actions"],
  ] as const;
  const said = parts.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
  return said.length > 0 ? said.join(", ") : `No matches for "${query.trim()}".`;
}
