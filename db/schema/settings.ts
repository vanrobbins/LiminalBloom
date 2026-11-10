// ---------------------------------------------------------------------------
// A store's own settings (DECISIONS "Time", 10-12). Its own table so the
// generated Better Auth schema is never edited. Row-level security is added by
// hand in 0011, which also gives every existing store a row.
// ---------------------------------------------------------------------------

import { pgTable, text } from "drizzle-orm/pg-core";

import { organization } from "../auth-schema";

import { mapCreatedAt, mapUpdatedAt, mapVersion } from "./columns";

export const storeSettings = pgTable("store_settings", {
  storeId: text("store_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  // An IANA name; the server accepts only names in Intl.supportedValuesOf("timeZone").
  timezone: text("timezone").notNull(),
  version: mapVersion(),
  createdAt: mapCreatedAt(),
  updatedAt: mapUpdatedAt(),
});
