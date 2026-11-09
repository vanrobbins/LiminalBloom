// Writes against the dev database: version guards, duplicate names, the
// category count guard, store isolation, and that a refused save writes nothing.

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { productCategories, productFootprints, products } from "@/db/schema";

import { createCategory, deleteCategory, updateCategory } from "./category-write";
import { productDetail } from "./queries";
import type { ProductInput } from "./schemas";
import { dropStores, makeStore, productCount, seedStoreFixtures } from "./test-stores";
import { createProduct, deleteProduct, setProductImage, setProductStatus, updateProduct } from "./write";

afterAll(dropStores);

const defaults = { hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, sizeRange: "" };
const productInput = (categoryId: string, over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Wide-Leg Trouser",
  styleNumber: `WLT-${randomUUID().slice(0, 6)}`,
  categoryId,
  color: "Olive",
  sizeRange: "XS–XL",
  status: "in_stock",
  swatch: null,
  texture: "solid",
  overrides: { hung: null, folded: null },
  ...over,
});

describe("categories", () => {
  it("creates, renames, and refuses a duplicate name in any case", async () => {
    const store = await makeStore("cat");
    const created = await createCategory(store, { name: "Knits", ...defaults });
    expect(created.status).toBe("saved");
    expect(await createCategory(store, { name: "knits", ...defaults })).toEqual({ status: "duplicate", field: "name" });
    if (created.status !== "saved") return;
    expect(await updateCategory(store, created.id, 1, { name: "Sweaters", ...defaults })).toEqual({ status: "saved" });
    expect(await updateCategory(store, created.id, 1, { name: "Stale", ...defaults })).toEqual({ status: "conflict" });
  });

  it("deletes a category with its products only when the count it showed is still right", async () => {
    const store = await makeStore("cat-delete");
    const f = await seedStoreFixtures(store);
    await db.update(products).set({ imagePath: `stores/${store}/products/x.webp` }).where(eq(products.id, f.productId));
    expect(await deleteCategory(store, f.categoryId, 1, 0)).toEqual({ status: "count-changed", count: 1 });
    expect(await productCount(store)).toBe(1);
    expect(await deleteCategory(store, f.categoryId, 1, 1)).toEqual({ status: "saved", imagePaths: [`stores/${store}/products/x.webp`] });
    expect(await productCount(store)).toBe(0);
  });

  it("calls a stale category version a conflict, not a count change", async () => {
    const store = await makeStore("cat-delete-stale");
    const f = await seedStoreFixtures(store);
    expect(await deleteCategory(store, f.categoryId, 7, 1)).toEqual({ status: "conflict" });
  });
});

describe("products", () => {
  it("creates a product with an override and reads it back", async () => {
    const store = await makeStore("product");
    const f = await seedStoreFixtures(store);
    const result = await createProduct(store, productInput(f.categoryId, { overrides: { hung: { columns: 2, rows: 4 }, folded: null } }));
    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect((await productDetail(store, result.id))?.overrides).toEqual({ hung: { columns: 2, rows: 4 } });
  });

  it("refuses a duplicate style number in any case", async () => {
    const store = await makeStore("product-dup");
    const f = await seedStoreFixtures(store);
    await createProduct(store, productInput(f.categoryId, { styleNumber: "ABC-1" }));
    expect(await createProduct(store, productInput(f.categoryId, { styleNumber: "abc-1" }))).toEqual({ status: "duplicate", field: "styleNumber" });
  });

  it("refuses another store's category", async () => {
    const a = await makeStore("product-cross-a");
    const b = await makeStore("product-cross-b");
    const fb = await seedStoreFixtures(b);
    expect(await createProduct(a, productInput(fb.categoryId))).toEqual({ status: "not-found" });
  });

  it("replaces overrides on update and refuses a stale version without touching them", async () => {
    const store = await makeStore("product-update");
    const f = await seedStoreFixtures(store);
    const withOverride = { hung: { columns: 2, rows: 4 }, folded: null };
    expect(await updateProduct(store, f.productId, 1, productInput(f.categoryId, { overrides: withOverride }))).toEqual({ status: "saved" });
    // Another device, still at version 1, tries to clear it.
    expect(await updateProduct(store, f.productId, 1, productInput(f.categoryId))).toEqual({ status: "conflict" });
    expect(await db.select().from(productFootprints).where(eq(productFootprints.productId, f.productId))).toHaveLength(1);
  });

  // Week 6.5 spec §3.2: a product stores space only where it differs from its category's.
  it("stores a product's own space only where it differs, and drops it when the product uses the category's again", async () => {
    const store = await makeStore("product-space");
    const f = await seedStoreFixtures(store);
    const rows = () => db.select().from(productFootprints).where(eq(productFootprints.productId, f.productId));
    // The category is hung 1 ft × 3, folded 2 ft × 2 (the column defaults).
    const same = { hung: { columns: 2, rows: 3 }, folded: { columns: 4, rows: 2 } };
    expect(await updateProduct(store, f.productId, 1, productInput(f.categoryId, { overrides: same }))).toEqual({ status: "saved" });
    expect(await rows()).toHaveLength(0);
    const hungDiffers = { hung: { columns: 3, rows: 3 }, folded: { columns: 4, rows: 2 } };
    expect(await updateProduct(store, f.productId, 2, productInput(f.categoryId, { overrides: hungDiffers }))).toEqual({ status: "saved" });
    expect((await rows()).map((r) => [r.presentation, r.columns, r.rows])).toEqual([["hung", 3, 3]]);
    expect(await updateProduct(store, f.productId, 3, productInput(f.categoryId))).toEqual({ status: "saved" });
    expect(await rows()).toHaveLength(0);
  });

  it("saves null to inherit the category's size range, and reads back the effective one", async () => {
    const store = await makeStore("product-size");
    const f = await seedStoreFixtures(store);
    await db.update(productCategories).set({ sizeRange: "24–34" }).where(eq(productCategories.id, f.categoryId));
    await updateProduct(store, f.productId, 1, productInput(f.categoryId, { sizeRange: null }));
    expect((await productDetail(store, f.productId))?.product).toMatchObject({ sizeRange: "24–34", sizeIsOwn: false });
    await updateProduct(store, f.productId, 2, productInput(f.categoryId, { sizeRange: "One size", swatch: "#1f3a5c", texture: "denim" }));
    expect((await productDetail(store, f.productId))?.product).toMatchObject({ sizeRange: "One size", sizeIsOwn: true, swatch: "#1f3a5c", texture: "denim" });
  });

  it("refuses a swatch that isn't #rrggbb, and has no stack limit columns (migration 0012)", async () => {
    const store = await makeStore("product-0012");
    const f = await seedStoreFixtures(store);
    await expect(db.update(products).set({ swatch: "navy" }).where(eq(products.id, f.productId))).rejects.toThrow();
    const columns = await db.execute(sql`select table_name from information_schema.columns where column_name = 'stack_limit' and table_name in ('product_categories', 'product_footprints')`);
    expect(columns.rows).toEqual([]);
    const [row] = await db.select({ sizeRange: products.sizeRange, texture: products.texture }).from(products).where(eq(products.id, f.productId));
    expect(row).toEqual({ sizeRange: null, texture: "solid" });
  });

  it("cannot update another store's product", async () => {
    const a = await makeStore("product-other-a");
    const b = await makeStore("product-other-b");
    const fa = await seedStoreFixtures(a);
    const fb = await seedStoreFixtures(b);
    expect(await updateProduct(a, fb.productId, 1, productInput(fa.categoryId))).toEqual({ status: "conflict" });
  });

  it("sets status with a version guard", async () => {
    const store = await makeStore("status");
    const f = await seedStoreFixtures(store);
    expect(await setProductStatus(store, f.productId, 1, "sold_out")).toEqual({ status: "saved", version: 2 });
    expect(await setProductStatus(store, f.productId, 1, "on_sale")).toEqual({ status: "conflict" });
  });

  it("swaps the image path and hands back the previous one", async () => {
    const store = await makeStore("image");
    const f = await seedStoreFixtures(store);
    expect(await setProductImage(store, f.productId, "p/one.webp")).toEqual({ status: "saved", previous: null });
    expect(await setProductImage(store, f.productId, "p/two.webp")).toEqual({ status: "saved", previous: "p/one.webp" });
    expect(await setProductImage(store, randomUUID(), "p/three.webp")).toEqual({ status: "not-found" });
  });

  // "Recently updated" on Products sorts by this (Week 6.5 spec §2.3).
  it("moves updated_at on every product write: form save, overrides, status and image", async () => {
    const store = await makeStore("updated-at");
    const f = await seedStoreFixtures(store);
    const old = new Date(Date.UTC(2020, 0, 1));
    const stamp = async () => (await db.select({ at: products.updatedAt }).from(products).where(eq(products.id, f.productId)))[0].at;
    const writes: [string, () => Promise<unknown>][] = [
      ["form save with an override", () => updateProduct(store, f.productId, 1, productInput(f.categoryId, { overrides: { hung: { columns: 2, rows: 4 }, folded: null } }))],
      ["status", () => setProductStatus(store, f.productId, 2, "sold_out")],
      ["image", () => setProductImage(store, f.productId, "p/new.webp")],
    ];
    for (const [what, write] of writes) {
      await db.update(products).set({ updatedAt: old }).where(eq(products.id, f.productId));
      await write();
      expect((await stamp()).getTime(), what).toBeGreaterThan(old.getTime());
    }
  });

  it("deletes a product and hands back its image path", async () => {
    const store = await makeStore("product-delete");
    const f = await seedStoreFixtures(store);
    await setProductImage(store, f.productId, "p/gone.webp");
    expect(await deleteProduct(store, f.productId, 1)).toEqual({ status: "saved", imagePath: "p/gone.webp" });
    expect(await productCount(store)).toBe(0);
  });
});
