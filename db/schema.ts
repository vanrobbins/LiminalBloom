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
 * The product catalog. One row per style the store carries.
 *
 * Every product belongs to exactly one store. `organization` is Better
 * Auth's table for stores -- see docs/DECISIONS.md for why it owns it.
 * Deleting a store deletes its products with it.
 */
export const products = pgTable("products", {
  // `defaultRandom()` makes Postgres generate the id, so the app never has to.
  id: uuid("id").primaryKey().defaultRandom(),
  // Every query for products must filter on this. Section 8.2.
  storeId: text("store_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  styleNumber: text("style_number").notNull(),
  category: text("category").notNull(),
  color: text("color").notNull(),
  status: productStatus("status").notNull().default("in_stock"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
