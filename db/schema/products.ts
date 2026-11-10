// Products and their categories.

import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../auth-schema";

/** The pattern drawn over a product's drawing (Week 6.5 spec §4.4). */
export const productTexture = pgEnum("product_texture", ["solid", "stripes", "check", "dots", "denim", "rib"]);

/**
 * A product's current state on the floor. Postgres enforces that a row can
 * only hold one of these three values, so a typo can never reach the table.
 * Quick Adjust (3.4) reacts to `sold_out` and `on_sale`.
 */
export const productStatus = pgEnum("product_status", [
  "in_stock",
  "sold_out",
  "on_sale",
]);

/**
 * A store's product categories, each with the footprint its products take by
 * default (§3.9 item 6). Products only store an override when they differ, so
 * a VM Lead sets a category once and adjusts the exceptions (§10 risk table).
 * Defined above `products` because products reference it.
 */
export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: text("store_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hungColumns: integer("hung_columns").notNull().default(2),
    hungRows: integer("hung_rows").notNull().default(3),
    foldedColumns: integer("folded_columns").notNull().default(4),
    foldedRows: integer("folded_rows").notNull().default(2),
    // The default a product inherits while its own is null (Week 6.5 spec §3.4); "" means none.
    sizeRange: text("size_range").notNull().default(""),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The target of products' (store_id, category_id) key: a product can only
    // ever point at a category of its own store.
    uniqueIndex("product_categories_store_id_unique").on(t.storeId, t.id),
    uniqueIndex("product_categories_name_unique").on(t.storeId, sql`lower(${t.name})`),
    index("product_categories_name_trgm").using("gin", sql`lower(${t.name}) gin_trgm_ops`),
    // Columns are half a foot (DECISIONS 10-12); rows are levels.
    check(
      "product_categories_ranges",
      sql`${t.hungColumns} between 1 and 48 and ${t.hungRows} between 1 and 24 and ${t.foldedColumns} between 1 and 48 and ${t.foldedRows} between 1 and 24`,
    ),
  ],
);

/**
 * The product catalog. One row per style the store carries.
 *
 * Every product belongs to exactly one store. `organization` is Better
 * Auth's table for stores -- see docs/DECISIONS.md for why it owns it.
 * Deleting a store deletes its products with it.
 */
export const products = pgTable(
  "products",
  {
    // `defaultRandom()` makes Postgres generate the id, so the app never has to.
    id: uuid("id").primaryKey().defaultRandom(),
    // Every query for products must filter on this. Section 8.2.
    storeId: text("store_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    styleNumber: text("style_number").notNull(),
    // Deleting a category deletes its products (DECISIONS 10-04); the key is
    // (store_id, category_id) so it can only name a category of this store.
    categoryId: uuid("category_id").notNull(),
    color: text("color").notNull(),
    // Null inherits the category's size range (Week 6.5 spec §3.4).
    sizeRange: text("size_range"),
    // A drawing's own colour, #rrggbb; null matches the colour word (spec §3.5, §4.3).
    swatch: text("swatch"),
    texture: productTexture("texture").notNull().default("solid"),
    // The private Blob pathname; served only through /api/images/[productId].
    imagePath: text("image_path"),
    status: productStatus("status").notNull().default("in_stock"),
    version: integer("version").notNull().default(1),
    // What text search matches (spec §4.7), kept in step by Postgres itself.
    searchText: text("search_text").generatedAlwaysAs(
      sql`lower(name || ' ' || style_number || ' ' || color)`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("products_store_id_unique").on(t.storeId, t.id),
    check("products_swatch_hex", sql`${t.swatch} ~ '^#[0-9a-f]{6}$'`),
    uniqueIndex("products_style_unique").on(t.storeId, sql`lower(${t.styleNumber})`),
    index("products_category_idx").on(t.categoryId),
    index("products_search_trgm").using("gin", sql`${t.searchText} gin_trgm_ops`),
    foreignKey({
      name: "products_category_fk",
      columns: [t.storeId, t.categoryId],
      foreignColumns: [productCategories.storeId, productCategories.id],
    }).onDelete("cascade"),
  ],
);

// Types derived from the table above, so the rest of the app stays in sync
// with the schema automatically. Change a column and these change with it.
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
