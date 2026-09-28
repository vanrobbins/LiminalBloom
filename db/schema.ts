// The database schema: TypeScript descriptions of the tables.
//
// This file is the source of truth. You never write CREATE TABLE by hand --
// drizzle-kit reads this, compares it to the real database, and writes the
// SQL needed to make the database match.
//
// Tables are defined as they appear in docs/projectOutline.md section 7.

import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
 * The product catalog. One row per style the store carries.
 *
 * Note: section 7 gives this table a store ID pointing at `organizations`.
 * That table is created by Better Auth's organization plugin, which is not
 * installed yet, so the column and its foreign key are added immediately
 * after authentication lands rather than hand-written here first.
 */
export const products = pgTable("products", {
  // `defaultRandom()` makes Postgres generate the id, so the app never has to.
  id: uuid("id").primaryKey().defaultRandom(),
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
