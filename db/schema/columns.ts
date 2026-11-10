// Column helpers shared by the store-scoped tables (store map onward).

import { integer, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-schema";

export const mapStoreId = () =>
  text("store_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
export const mapVersion = () => integer("version").notNull().default(1);
export const mapCreatedAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const mapUpdatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
