// Each store's encryption keys and their log (proposal 8.1).

import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../auth-schema";

/** Only one key per store may be active at a time. */
export const keyStatus = pgEnum("key_status", ["active", "retired"]);

/** What happened to a key. Rotation lands in Week 8. */
export const keyEvent = pgEnum("key_event", ["created", "rotated", "retired"]);

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
