// Search and the Locator's reads against the dev database (spec §11): typo
// tolerance, ranking, filters, the trigram index, labels, and store isolation.

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { fixtures, productCategories, productLocations, products, tableSets } from "@/db/schema";

import { WORD_SIMILARITY_THRESHOLD, isTextQuery, listCategories, locationsFor, productDetail, search, searchProducts } from "./queries";
import { searchInput } from "./schemas";
import { dropStores, makeStore, seedStoreFixtures, type StoreFixtures } from "./test-stores";

let a: string;
let b: string;
let fa: StoreFixtures;
let fb: StoreFixtures;

const input = (over: Record<string, unknown> = {}) => searchInput.parse(over);

beforeAll(async () => {
  a = await makeStore("query-a");
  b = await makeStore("query-b");
  fa = await seedStoreFixtures(a, "High-Rise Pant");
  fb = await seedStoreFixtures(b, "High-Rise Pant");
  const [tees] = await db.insert(productCategories).values({ storeId: a, name: "Tees" }).returning({ id: productCategories.id });
  await db.insert(products).values([
    { storeId: a, name: "Rise Tee", styleNumber: "RT-1", categoryId: tees.id, color: "White", status: "sold_out" },
    { storeId: a, name: "Pocket Tee", styleNumber: "PT-1", categoryId: tees.id, color: "Navy" },
  ]);
  const [rise] = await db.select({ id: products.id }).from(products).where(eq(products.styleNumber, "RT-1"));
  await db.insert(productLocations).values({ storeId: a, productId: rise.id, presentation: "folded", binId: fa.binId });
});

afterAll(dropStores);

describe("searchProducts", () => {
  it("finds a product through typos and missing letters", async () => {
    const rows = await searchProducts(a, input({ q: "hi rise pnt" }));
    expect(rows[0]?.name).toBe("High-Rise Pant");
  });

  it("ranks the closest match first", async () => {
    const rows = await searchProducts(a, input({ q: "rise tee" }));
    expect(rows[0]?.name).toBe("Rise Tee");
  });

  it("matches the category name", async () => {
    const rows = await searchProducts(a, input({ q: "tees" }));
    expect(rows.map((r) => r.name).sort()).toEqual(["Pocket Tee", "Rise Tee"]);
  });

  it("matches the style number", async () => {
    expect((await searchProducts(a, input({ q: "pt-1" })))[0]?.name).toBe("Pocket Tee");
  });

  it("never sees another store's products", async () => {
    const rows = await searchProducts(a, input({ q: "high rise pant" }));
    expect(rows.map((r) => r.id)).not.toContain(fb.productId);
    expect(rows[0].id).toBe(fa.productId);
  });

  it("browses by name when the text is too short or only punctuation", async () => {
    for (const q of ["", "a", "%%", "'_"]) {
      const rows = await searchProducts(a, input({ q }));
      expect(rows.map((r) => r.name)).toEqual(["High-Rise Pant", "Pocket Tee", "Rise Tee"]);
    }
  });

  it("treats quotes and wildcards as plain text", async () => {
    await expect(searchProducts(a, input({ q: "pant'; drop table products; --" }))).resolves.toBeDefined();
    await expect(searchProducts(a, input({ q: "100%_off" }))).resolves.toBeDefined();
  });

  it("filters by status, color and place", async () => {
    expect((await searchProducts(a, input({ statuses: ["sold_out"] }))).map((r) => r.name)).toEqual(["Rise Tee"]);
    expect((await searchProducts(a, input({ colors: ["navy"] }))).map((r) => r.name)).toEqual(["Pocket Tee"]);
    expect((await searchProducts(a, input({ places: ["floor"] }))).map((r) => r.name)).toEqual(["High-Rise Pant"]);
    expect((await searchProducts(a, input({ places: ["stockroom"] }))).map((r) => r.name)).toEqual(["Rise Tee"]);
    expect((await searchProducts(a, input({ places: ["unplaced"] }))).map((r) => r.name)).toEqual(["Pocket Tee"]);
  });

  it("uses the trigram index", async () => {
    // As the owner, so row-level security's store filter does not give the planner a cheaper btree.
    const [, , , plan] = await db.batch([
      db.execute(sql`set local enable_seqscan = off`),
      db.execute(sql`set local enable_indexscan = off`),
      db.execute(sql`select set_config('pg_trgm.word_similarity_threshold', ${WORD_SIMILARITY_THRESHOLD}, true)`),
      db.execute(sql`explain select id from products where ${"pant"} <% search_text`),
    ] as const);
    expect(JSON.stringify(plan.rows)).toContain("products_search_trgm");
  });
});

describe("isTextQuery", () => {
  it("needs two characters including a letter or digit", () => {
    expect([isTextQuery("a"), isTextQuery("ab"), isTextQuery("--"), isTextQuery("é1")]).toEqual([false, true, false, true]);
  });
});

describe("locations", () => {
  it("labels floor and bin locations and returns the face grid", async () => {
    const [floor] = await locationsFor(a, [fa.productId]);
    expect(floor).toMatchObject({ label: "Front table 1 · Left · Middle", detail: "0–1 ft from left · 0–2 ft from back", presentation: "folded" });
    expect(floor.floor).toEqual({ fixtureId: fa.fixtureId, faceId: fa.faceId, grid: { columns: 6, rows: 3 }, cells: { col: 0, row: 0, colSpan: 2, rowSpan: 2 } });
    const { results } = await search(a, input({ q: "rise tee" }));
    expect(results[0].locations[0]).toMatchObject({ label: "Stockroom, bin B-12", floor: null });
  });

  it("counts every match, not just the page shown", async () => {
    const page = await search(a, input({ q: "" }), 1);
    expect(page.results).toHaveLength(1);
    expect(page.total).toBeGreaterThan(1);
  });

  it("reads a back lower table from its outer edge, and keeps the stored cells for the grid", async () => {
    // Front table 1's top (6 x 3) becomes the back lower of a set; its pant sits at the stored back-left.
    const upperId = randomUUID();
    await db.insert(fixtures).values({ id: upperId, storeId: a, type: "table", name: "Upper", x: 100, y: 200, width: 72, depth: 36 });
    const setId = randomUUID();
    await db.insert(tableSets).values({ id: setId, storeId: a, upperFixtureId: upperId });
    await db.update(fixtures).set({ tableSetId: setId, setSide: "back" }).where(eq(fixtures.id, fa.fixtureId));
    try {
      const [floor] = await locationsFor(a, [fa.productId]);
      expect(floor).toMatchObject({ label: "Front table 1 · Right · Front", detail: "2–3 ft from left · 1–3 ft from back" });
      expect(floor.floor?.cells).toEqual({ col: 0, row: 0, colSpan: 2, rowSpan: 2 });
    } finally {
      await db.update(fixtures).set({ tableSetId: null, setSide: null }).where(eq(fixtures.id, fa.fixtureId));
    }
  });

  it("returns nothing for no ids or another store's ids", async () => {
    expect(await locationsFor(a, [])).toEqual([]);
    const other = await searchProducts(b, input({ q: "high rise pant" }));
    expect(await locationsFor(a, [other[0].id])).toEqual([]);
  });
});

describe("productDetail and categories", () => {
  it("loads a product with its category and locations", async () => {
    const detail = await productDetail(a, fa.productId);
    expect(detail?.category.name).toBe("Pants");
    expect(detail?.overrides).toEqual({});
    expect(detail?.locations).toHaveLength(1);
  });

  it("returns null for another store's product or a missing id", async () => {
    const other = await searchProducts(b, input({ q: "high rise pant" }));
    expect(await productDetail(a, other[0].id)).toBeNull();
    expect(await productDetail(a, randomUUID())).toBeNull();
  });

  it("counts each category's products", async () => {
    const categories = await listCategories(a);
    expect(categories.map((c) => [c.name, c.productCount])).toEqual([["Pants", 1], ["Tees", 2]]);
  });
});
