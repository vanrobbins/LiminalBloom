// ---------------------------------------------------------------------------
// The product library and its places (docs/superpowers/specs/
// 2026-10-04-product-library-search-design.md §4). Cross-table keys include
// store_id, so a row can only point at rows of its own store. Row-level
// security on these tables and products is added by hand in migration 0006.
// ---------------------------------------------------------------------------

import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { mapCreatedAt, mapStoreId } from "./columns";
import { fixtureFaces } from "./fixtures";
import { zones } from "./map";
import { products } from "./products";

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
      sql`${t.columns} between 1 and 48 and ${t.rows} between 1 and 24`,
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
    zoneId: uuid("zone_id"),
  },
  (t) => [
    uniqueIndex("stockroom_bins_store_id_unique").on(t.storeId, t.id),
    uniqueIndex("stockroom_bins_code_unique").on(t.storeId, sql`lower(${t.code})`),
    // Composite FK: a bin can only reference a zone in its own store.
    foreignKey({
      name: "stockroom_bins_zone_fk",
      columns: [t.storeId, t.zoneId],
      foreignColumns: [zones.storeId, zones.id],
    }).onDelete("set null"),
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
    /** Front to back among hung products sharing rail space, 0 = front (DECISIONS 11-09). */
    depth: integer("depth").notNull().default(0),
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
      sql`${t.col} between 0 and 47 and ${t.row} between 0 and 23 and ${t.colSpan} between 1 and 48 and ${t.rowSpan} between 1 and 24 and ${t.col} + ${t.colSpan} <= 48`,
    ),
    check("product_locations_depth", sql`${t.depth} between 0 and 98`),
  ],
);
