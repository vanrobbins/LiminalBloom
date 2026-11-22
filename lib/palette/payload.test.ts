import { describe, expect, it } from "vitest";

import { face, fixture } from "@/lib/layout/test-layouts";
import { EMPTY_LAYOUT, type Layout } from "@/lib/layout/types";
import type { SearchResult } from "@/lib/products/queries";

import { toPaletteIndex, toPaletteProducts } from "./payload";

const zone = (id: string, name: string) => ({ id, name, type: "display" as const, color: "zone-1" as const, points: [], version: 1 });
const layout: Layout = {
  ...EMPTY_LAYOUT,
  zones: [zone("zb", "Women"), zone("za", "Men"), zone("empty", "Empty zone")],
  fixtures: [
    fixture({ id: "bay", type: "wall_bay", name: "Denim Wall · Bay 3", zoneId: "za" }),
    fixture({ id: "rack", type: "rack", name: "Front fixture", zoneId: "za" }),
    fixture({ id: "table", type: "table", name: "Table 2", zoneId: "zb" }),
    fixture({ id: "lower", type: "table", name: "", tableSetId: "set", setSide: "front", zoneId: "zb" }),
    fixture({ id: "loose", type: "rack", name: "Rack 9", zoneId: null }),
  ],
  faces: ["bay", "rack", "table", "lower", "loose"].map((id) => face({ id: `f-${id}`, fixtureId: id, side: "front" })),
  tableSets: [{ id: "set", upperFixtureId: "table", version: 1 }],
};
const published = { publishedVersion: 3, publishedAt: new Date("2026-10-08T12:00:00Z"), hasDraft: true, dueDate: "2026-10-15" };
const summaries = [
  { fixtureId: "bay", ...published },
  { fixtureId: "rack", publishedVersion: null, publishedAt: null, hasDraft: true, dueDate: null },
];

describe("toPaletteIndex", () => {
  const index = toPaletteIndex(layout, summaries);

  it("names each planogram's zone and one state, the /planograms words: Version, else Draft, else Not published", () => {
    const by = (id: string) => index.planograms.find((p) => p.fixtureId === id);
    expect(by("bay")).toMatchObject({ name: "Denim Wall · Bay 3", zoneName: "Men", state: "Version 3", typeHint: "Wall bay" });
    expect(by("rack")).toMatchObject({ state: "Draft", typeHint: "Rack" });
    expect(by("table")).toMatchObject({ zoneName: "Women", state: "Not published" });
    expect(by("loose")).toMatchObject({ zoneName: "Not in a zone" });
  });

  it("lists a fixture once: a lower table is covered by its upper", () => {
    expect(index.planograms.some((p) => p.fixtureId === "lower")).toBe(false);
    expect(index.planograms).toHaveLength(4);
  });

  it("counts each zone's fixtures without lower tables, zones by name", () => {
    expect(index.zones).toEqual([
      { id: "empty", name: "Empty zone", fixtureCount: 0 },
      { id: "za", name: "Men", fixtureCount: 2 },
      { id: "zb", name: "Women", fixtureCount: 1 },
    ]);
  });

  it("sends nothing but names, ids and words: no dates, versions as numbers, or due dates", () => {
    const text = JSON.stringify(index);
    expect(text).not.toMatch(/2026-10|dueDate|publishedAt|"version"|hasDraft|points|color/);
    expect(Object.keys(index.planograms[0]).sort()).toEqual(["fixtureId", "name", "state", "zoneName"].concat(index.planograms[0].typeHint ? ["typeHint"] : []).sort());
  });
});

const row = (over: Partial<SearchResult> = {}): SearchResult => ({
  id: "p1",
  name: "Navy Tee",
  styleNumber: "NT-104",
  color: "Navy",
  sizeRange: "S-XL",
  sizeIsOwn: false,
  swatch: null,
  texture: "solid",
  status: "sold_out",
  version: 7,
  categoryId: "c1",
  categoryName: "Tees",
  imageKey: "abc.webp",
  locations: [],
  ...over,
});
const loc = (label: string) => ({ id: label, productId: "p1", presentation: "hung" as const, label, detail: "2 ft · 1 level", behind: "Behind X", floor: null });

describe("toPaletteProducts", () => {
  it("keeps the name, style number, status, first place and how many more", () => {
    const out = toPaletteProducts({ results: [row({ locations: [loc("Front table"), loc("Stockroom bin A"), loc("Rack 2")] })], total: 40 });
    expect(out).toEqual({ products: [{ id: "p1", name: "Navy Tee", styleNumber: "NT-104", status: "sold_out", place: "Front table", more: 2 }], total: 40 });
  });

  it("says no place and no more for a product that is not placed", () => {
    expect(toPaletteProducts({ results: [row()], total: 1 }).products[0]).toMatchObject({ place: null, more: 0 });
  });

  it("sends no image key, version, category, colour or location detail", () => {
    const text = JSON.stringify(toPaletteProducts({ results: [row({ locations: [loc("Front table")] })], total: 1 }));
    expect(text).not.toMatch(/abc\.webp|imageKey|version|categoryId|categoryName|Tees|Navy"|S-XL|1 level|Behind|floor/);
  });
});
