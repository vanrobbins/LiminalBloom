import { describe, expect, it } from "vitest";

import { BUILTIN_ROLES } from "@/lib/access/roles";

import { commandsFor } from "./commands";
import { describeResults, keepActive, paletteGroups } from "./groups";
import type { PaletteIndex, PaletteProducts, RecentPick } from "./types";

const commands = commandsFor({ switches: BUILTIN_ROLES[0].switches }, [{ id: "s1", name: "Main" }], "s1", "light");
const planograms = Array.from({ length: 7 }, (_, i) => ({ fixtureId: `f${i}`, name: `Rack ${i + 1}`, zoneName: "Denim", state: "Draft" }));
const index: PaletteIndex = {
  planograms: [...planograms, { fixtureId: "t1", name: "Front Table", typeHint: "Table", zoneName: "Entry", state: "Version 3" }],
  zones: [1, 2, 3, 4, 5].map((n) => ({ id: `z${n}`, name: `Rack zone ${n}`, fixtureCount: n })),
};
const product = (n: number) => ({ id: `p${n}`, name: `Navy Tee ${n}`, styleNumber: `NT-${n}`, status: "in_stock" as const, place: "Front table", more: 0 });
const products: PaletteProducts = { products: [1, 2, 3, 4, 5].map(product), total: 12 };
const keys = (g: ReturnType<typeof paletteGroups>) => g.map((x) => x.key);
const run = (q: string, o: { index?: PaletteIndex | null; products?: PaletteProducts | null; recent?: RecentPick[] } = {}) =>
  paletteGroups(q, commands, o.index === undefined ? index : o.index, o.products === undefined ? products : o.products, o.recent ?? []);

describe("paletteGroups, empty query", () => {
  it("lists Go to then Actions, and no products", () => {
    expect(keys(run(""))).toEqual(["goto", "actions"]);
    expect(keys(run("   "))).toEqual(["goto", "actions"]);
  });

  it("puts Recent first, at most 5, newest first as given", () => {
    const recent: RecentPick[] = Array.from({ length: 6 }, (_, i) => ({ id: `zone:z${i}`, kind: "zone", label: `Z${i}`, href: `/layout?zone=z${i}` }));
    const g = run("", { recent });
    expect(keys(g)).toEqual(["recent", "goto", "actions"]);
    expect(g[0].items.map((i) => i.label)).toEqual(["Z0", "Z1", "Z2", "Z3", "Z4"]);
    expect(g[0].items[0]).toMatchObject({ kind: "recent", id: "recent:zone:z0", of: "zone" });
  });

  it("drops a recent page or action the person no longer has", () => {
    const recent: RecentPick[] = [
      { id: "action:/store/roles", kind: "action", label: "Roles and permissions", href: "/store/roles" },
      { id: "action:/gone", kind: "action", label: "Gone", href: "/gone" },
      { id: "page:/store", kind: "page", label: "Store", href: "/store" },
    ];
    expect(run("", { recent })[0].items.map((i) => i.label)).toEqual(["Roles and permissions", "Store"]);
  });
});

describe("paletteGroups, with a query", () => {
  it("orders Planograms, Zones, Products, Go to, Actions, each only when it has a match", () => {
    const g = run("rack");
    expect(keys(g)).toEqual(["planograms", "zones", "products"]);
    expect(keys(run("store"))).toEqual(["products", "goto", "actions"]);
    expect(keys(run("st"))).toContain("goto");
    expect(keys(run("tee"))).toEqual(["products"]);
  });

  it("caps planograms at 5 and zones at 3, in natural order", () => {
    const g = run("rack");
    expect(g[0].items.map((i) => i.label)).toEqual(["Rack 1", "Rack 2", "Rack 3", "Rack 4", "Rack 5"]);
    expect(g[1].items).toHaveLength(3);
  });

  it("matches a planogram by its type hint and zone name", () => {
    expect(run("table")[0].items.map((i) => i.label)).toEqual(["Front Table"]);
    expect(run("entry")[0].items.map((i) => i.label)).toEqual(["Front Table"]);
  });

  it("says Zone · state on a planogram and Zone · N fixtures on a zone", () => {
    const g = run("front");
    expect(g[0].items[0]).toMatchObject({ second: "Entry · Version 3", href: "/planograms/t1" });
    expect(run("rack zone 2")[0].items[0]).toMatchObject({ second: "Zone · 2 fixtures", href: "/layout?zone=z2" });
    expect(run("rack zone 1")[0].items[0]).toMatchObject({ second: "Zone · 1 fixture" });
  });

  it("appends products last among the result groups, with All N products matching", () => {
    const g = run("rack tee");
    expect(g.at(-1)?.key).toBe("products");
    const g2 = run("navy");
    const items = g2[0].items;
    expect(items.slice(0, 5).map((i) => i.kind)).toEqual(["product", "product", "product", "product", "product"]);
    expect(items[5]).toMatchObject({ kind: "all-products", label: 'All 12 products matching "navy"', href: "/products?q=navy" });
    expect(items[0]).toMatchObject({ href: "/products?q=navy&open=p1" });
  });

  it("caps products at 5 even if the server sent more", () => {
    const more = { products: [1, 2, 3, 4, 5, 6, 7].map(product), total: 7 };
    expect(run("navy", { products: more })[0].items.filter((i) => i.kind === "product")).toHaveLength(5);
  });

  it("offers All products matching for text queries only, even before products arrive", () => {
    expect(run("navy", { products: null })[0].items).toMatchObject([{ kind: "all-products", label: 'All products matching "navy"' }]);
    expect(run("n", { products: null }).flatMap((g) => g.items).some((i) => i.kind === "all-products")).toBe(false);
    expect(run("-", { products: null }).flatMap((g) => g.items).some((i) => i.kind === "all-products")).toBe(false);
  });

  it("leaves out Planograms and Zones until the index arrives", () => {
    expect(keys(run("rack", { index: null }))).toEqual(["products"]);
  });

  it("builds product links from the query as typed, escaped", () => {
    expect(run("Navy & Tee")[0].items.at(-1)).toMatchObject({ href: "/products?q=Navy+%26+Tee" });
  });
});

describe("keepActive", () => {
  const options = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("keeps the id when it is still there, whatever its place", () => {
    expect(keepActive("b", options)).toBe("b");
    expect(keepActive("b", [{ id: "new" }, ...options])).toBe("b");
  });
  it("the fallback skips the placeholder All products row when anything else is listed", () => {
    expect(keepActive(null, [{ id: "all-products" }, { id: "b" }])).toBe("b");
    expect(keepActive("gone", [{ id: "a" }, { id: "all-products" }])).toBe("a");
    expect(keepActive(null, [{ id: "all-products" }])).toBe("all-products");
  });
  it("falls back to the first option when it vanished, and to null when there are none", () => {
    expect(keepActive("gone", options)).toBe("a");
    expect(keepActive(null, options)).toBe("a");
    expect(keepActive("a", [])).toBeNull();
  });
});

describe("describeResults", () => {
  it("counts what matched, leaving out the always-present All products row", () => {
    expect(describeResults(run("rack"), "rack")).toBe("5 planograms, 3 zones, 5 products");
    expect(describeResults(run("front table", { products: null }), "front table")).toBe("1 planogram");
  });
  it("counts pages and actions, and says so when nothing matched", () => {
    expect(describeResults(run("account", { products: null }), "account")).toBe("1 page or action");
    expect(describeResults(run("zzzz", { products: null }), " zzzz ")).toBe('No matches for "zzzz".');
  });
});
