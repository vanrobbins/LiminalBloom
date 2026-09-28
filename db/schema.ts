// The database schema: TypeScript descriptions of the tables.
//
// This file is the source of truth. You never write CREATE TABLE by hand --
// drizzle-kit reads this, compares it to the real database, and writes the
// SQL needed to make the database match.
//
// Tables are defined as they appear in docs/projectOutline.md section 7.

import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
