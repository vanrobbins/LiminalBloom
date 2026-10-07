// The database schema: TypeScript descriptions of the tables.
//
// This file is the source of truth. You never write CREATE TABLE by hand --
// drizzle-kit reads this, compares it to the real database, and writes the
// SQL needed to make the database match.
//
// Tables are defined as they appear in docs/projectOutline.md section 7.

import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { Point } from "@/lib/layout/types";

import { organization, user } from "./auth-schema";

/**
 * A product's current state on the floor. Postgres enforces that a row can
 * only hold one of these three values, so a typo can never reach the table.
 * Quick Adjust (3.4) reacts to `sold_out` and `on_sale`.
 */
/** Only one key per store may be active at a time. */
export const keyStatus = pgEnum("key_status", ["active", "retired"]);

/** What happened to a key. Rotation lands in Week 8. */
export const keyEvent = pgEnum("key_event", ["created", "rotated", "retired"]);

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
    hungColumns: integer("hung_columns").notNull().default(1),
    hungRows: integer("hung_rows").notNull().default(3),
    foldedColumns: integer("folded_columns").notNull().default(2),
    foldedRows: integer("folded_rows").notNull().default(2),
    stackLimit: integer("stack_limit").notNull().default(8),
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
    check(
      "product_categories_ranges",
      sql`${t.hungColumns} between 1 and 24 and ${t.hungRows} between 1 and 24 and ${t.foldedColumns} between 1 and 24 and ${t.foldedRows} between 1 and 24 and ${t.stackLimit} between 1 and 99`,
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
    sizeRange: text("size_range").notNull().default(""),
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

/**
 * Each store's encryption key, saved only in locked form (proposal 8.1).
 *
 * `wrappedKey` is the store's 256-bit key after being encrypted with the
 * master key, which lives only in the server environment. Reading a store's
 * secrets therefore needs both this row and the master key, and this row on
 * its own is useless to anyone who gets hold of the database.
 *
 * One row per version. Rotation (8.1 item 4, scheduled for Week 8) adds a new
 * active row and marks the old one retired; old versions are kept so data
 * sealed under them can still be opened during a rotation.
 */
export const storeKeys = pgTable("store_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: text("store_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  // The store key, encrypted by the master key. Never the key itself.
  wrappedKey: text("wrapped_key").notNull(),
  version: integer("version").notNull().default(1),
  status: keyStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
});

/**
 * Log of key creation, rotation, and retirement (proposal 7 and 8.4 item 5).
 * Records that something happened to a key, never any key material.
 */
export const keyEvents = pgTable("key_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: text("store_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  event: keyEvent("event").notNull(),
  keyVersion: integer("key_version").notNull(),
  // Who did it. Null when the system did it, such as on store creation.
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StoreKey = typeof storeKeys.$inferSelect;

// ---------------------------------------------------------------------------
// The store map (docs/superpowers/specs/2026-09-30-store-map-design.md §5).
//
// Every length is whole inches; rotation is whole degrees. Each row carries
// its store and a version that every save bumps, so two devices editing the
// same item can be told apart (spec §8). Row-level security on these six
// tables is added by hand in migration 0005.
// ---------------------------------------------------------------------------

export const zoneType = pgEnum("zone_type", [
  "display",
  "fitting_room",
  "cash_wrap",
  "stockroom",
  "other",
]);
export const zoneColor = pgEnum("zone_color", [
  "zone-1",
  "zone-2",
  "zone-3",
  "zone-4",
  "zone-5",
  "zone-6",
  "zone-7",
  "zone-8",
]);
export const fixtureType = pgEnum("fixture_type", [
  "table",
  "wall_bay",
  "rack",
  "mannequin",
  "platform",
  "prop",
]);
export const faceSide = pgEnum("face_side", ["front", "back", "left", "right", "top"]);
export const tableSide = pgEnum("table_side", ["front", "back", "left", "right"]);

const mapStoreId = () =>
  text("store_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
const mapVersion = () => integer("version").notNull().default(1);
const mapCreatedAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const mapUpdatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** One per store: the outline of the sales floor, as polygon corners. */
export const storeLayouts = pgTable("store_layouts", {
  storeId: text("store_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  outline: jsonb("outline").$type<Point[]>().notNull(),
  version: mapVersion(),
  createdAt: mapCreatedAt(),
  updatedAt: mapUpdatedAt(),
});

/** An opening in a wall: its centre and width. */
export const entrances = pgTable(
  "entrances",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    width: integer("width").notNull(),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    index("entrances_store_idx").on(t.storeId),
    check("entrances_width_range", sql`${t.width} between 36 and 240`),
  ],
);

export const zones = pgTable(
  "zones",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    name: text("name").notNull(),
    type: zoneType("type").notNull(),
    color: zoneColor("color").notNull(),
    points: jsonb("points").$type<Point[]>().notNull(),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [index("zones_store_idx").on(t.storeId)],
);

export const fixtures = pgTable(
  "fixtures",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    // Derived from the geometry on every save (spec §5); never trusted from a request.
    zoneId: uuid("zone_id").references(() => zones.id, { onDelete: "set null" }),
    type: fixtureType("type").notNull(),
    name: text("name").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    width: integer("width").notNull(),
    depth: integer("depth").notNull(),
    rotation: integer("rotation").notNull().default(0),
    // Lower tables only. Deleting the set deletes them.
    tableSetId: uuid("table_set_id").references((): AnyPgColumn => tableSets.id, {
      onDelete: "cascade",
    }),
    setSide: tableSide("set_side"),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    index("fixtures_store_idx").on(t.storeId),
    check("fixtures_rotation_range", sql`${t.rotation} between 0 and 359`),
    check("fixtures_size_range", sql`${t.width} between 12 and 600 and ${t.depth} between 12 and 600`),
  ],
);

/** A side of a fixture that displays product, with its grid of cells. */
export const fixtureFaces = pgTable(
  "fixture_faces",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    fixtureId: uuid("fixture_id")
      .notNull()
      .references(() => fixtures.id, { onDelete: "cascade" }),
    side: faceSide("side").notNull(),
    columns: integer("grid_columns").notNull(),
    rows: integer("grid_rows").notNull(),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    index("fixture_faces_store_idx").on(t.storeId),
    // The target of product_locations' (store_id, face_id) key.
    uniqueIndex("fixture_faces_store_id_unique").on(t.storeId, t.id),
    uniqueIndex("fixture_faces_side_unique").on(t.fixtureId, t.side),
    check("fixture_faces_grid_range", sql`${t.columns} between 1 and 24 and ${t.rows} between 1 and 24`),
  ],
);

/** One upper table and the lower tables on its sides. Deleting the upper deletes the set. */
export const tableSets = pgTable(
  "table_sets",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    upperFixtureId: uuid("upper_fixture_id")
      .notNull()
      .unique()
      .references((): AnyPgColumn => fixtures.id, { onDelete: "cascade" }),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [index("table_sets_store_idx").on(t.storeId)],
);

// ---------------------------------------------------------------------------
// The product library and its places (docs/superpowers/specs/
// 2026-10-04-product-library-search-design.md §4). Cross-table keys include
// store_id, so a row can only point at rows of its own store. Row-level
// security on these tables and products is added by hand in migration 0006.
// ---------------------------------------------------------------------------

export const presentation = pgEnum("presentation", ["hung", "folded"]);

/** A product's own footprint where it differs from its category's. */
export const productFootprints = pgTable(
  "product_footprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: mapStoreId(),
    productId: uuid("product_id").notNull(),
    presentation: presentation("presentation").notNull(),
    columns: integer("grid_columns").notNull(),
    rows: integer("grid_rows").notNull(),
    stackLimit: integer("stack_limit").notNull(),
  },
  (t) => [
    index("product_footprints_store_idx").on(t.storeId),
    uniqueIndex("product_footprints_unique").on(t.productId, t.presentation),
    foreignKey({
      name: "product_footprints_product_fk",
      columns: [t.storeId, t.productId],
      foreignColumns: [products.storeId, products.id],
    }).onDelete("cascade"),
    check(
      "product_footprints_ranges",
      sql`${t.columns} between 1 and 24 and ${t.rows} between 1 and 24 and ${t.stackLimit} between 1 and 99`,
    ),
  ],
);

/** A labelled place in the stockroom. */
export const stockroomBins = pgTable(
  "stockroom_bins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: mapStoreId(),
    code: text("code").notNull(),
    // Optional: the stockroom zone on the map it sits in. Display only.
    zoneId: uuid("zone_id").references(() => zones.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("stockroom_bins_store_id_unique").on(t.storeId, t.id),
    uniqueIndex("stockroom_bins_code_unique").on(t.storeId, sql`lower(${t.code})`),
  ],
);

/**
 * Where a product is: cells on a fixture face, or a stockroom bin (spec §4.5).
 * The span is stored, not derived, so a footprint change never silently moves
 * product that is already placed. Only the seed writes these until Week 5.
 */
export const productLocations = pgTable(
  "product_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: mapStoreId(),
    productId: uuid("product_id").notNull(),
    presentation: presentation("presentation").notNull(),
    faceId: uuid("face_id"),
    col: integer("col"),
    row: integer("row"),
    colSpan: integer("col_span"),
    rowSpan: integer("row_span"),
    binId: uuid("bin_id"),
    createdAt: mapCreatedAt(),
  },
  (t) => [
    index("product_locations_store_idx").on(t.storeId),
    index("product_locations_product_idx").on(t.productId),
    foreignKey({
      name: "product_locations_product_fk",
      columns: [t.storeId, t.productId],
      foreignColumns: [products.storeId, products.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "product_locations_face_fk",
      columns: [t.storeId, t.faceId],
      foreignColumns: [fixtureFaces.storeId, fixtureFaces.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "product_locations_bin_fk",
      columns: [t.storeId, t.binId],
      foreignColumns: [stockroomBins.storeId, stockroomBins.id],
    }).onDelete("cascade"),
    // Exactly one shape: every floor column set and no bin, or a bin and no floor column.
    check(
      "product_locations_shape",
      sql`(${t.binId} is null and ${t.faceId} is not null and ${t.col} is not null and ${t.row} is not null and ${t.colSpan} is not null and ${t.rowSpan} is not null)
        or (${t.binId} is not null and ${t.faceId} is null and ${t.col} is null and ${t.row} is null and ${t.colSpan} is null and ${t.rowSpan} is null)`,
    ),
    check(
      "product_locations_ranges",
      sql`${t.col} between 0 and 23 and ${t.row} between 0 and 23 and ${t.colSpan} between 1 and 24 and ${t.rowSpan} between 1 and 24`,
    ),
  ],
);
