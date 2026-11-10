// ---------------------------------------------------------------------------
// Planograms (docs/superpowers/specs/2026-10-08-planogram-management-design.md
// §3). The draft is rows, so edits get per-row versions, FKs and CHECKs; a
// published version is a JSONB snapshot, written once and never changed
// (app_store_user may only SELECT and INSERT it). RLS is added by hand in 0009.
// ---------------------------------------------------------------------------

import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import type { SnapshotEntry } from "@/lib/planograms/types";

import { user } from "../auth-schema";

import { mapCreatedAt, mapStoreId, mapUpdatedAt, mapVersion } from "./columns";
import { fixtureFaces, fixtures } from "./fixtures";
import { presentation } from "./library";
import { products } from "./products";

/** One per fixture (a table set's sits on its upper table). */
export const planograms = pgTable(
  "planograms",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    fixtureId: uuid("fixture_id").notNull(),
    // The published number the current draft started from.
    basedOnVersion: integer("based_on_version"),
    // Latest published number; null = never published.
    publishedVersion: integer("published_version"),
    hasDraft: boolean("has_draft").notNull().default(false),
    dueDate: date("due_date"),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    // The target of the placements' and versions' (store_id, planogram_id) composite FKs.
    uniqueIndex("planograms_store_id_unique").on(t.storeId, t.id),
    uniqueIndex("planograms_fixture_unique").on(t.fixtureId),
    index("planograms_store_idx").on(t.storeId),
    foreignKey({
      name: "planograms_fixture_fk",
      columns: [t.storeId, t.fixtureId],
      foreignColumns: [fixtures.storeId, fixtures.id],
    }).onDelete("cascade"),
  ],
);

/** The draft: one row per product placed on a face. */
export const planogramPlacements = pgTable(
  "planogram_placements",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    planogramId: uuid("planogram_id").notNull(),
    faceId: uuid("face_id").notNull(),
    productId: uuid("product_id").notNull(),
    presentation: presentation("presentation").notNull(),
    col: integer("col").notNull(),
    row: integer("row").notNull(),
    colSpan: integer("col_span").notNull(),
    rowSpan: integer("row_span").notNull(),
    pieceCount: integer("piece_count").notNull().default(1),
    /** Front to back among hung products sharing rail space, 0 = front; the server renumbers it (DECISIONS 11-09). */
    depth: integer("depth").notNull().default(0),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    index("planogram_placements_store_idx").on(t.storeId),
    index("planogram_placements_planogram_idx").on(t.planogramId),
    foreignKey({
      name: "planogram_placements_planogram_fk",
      columns: [t.storeId, t.planogramId],
      foreignColumns: [planograms.storeId, planograms.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "planogram_placements_face_fk",
      columns: [t.storeId, t.faceId],
      foreignColumns: [fixtureFaces.storeId, fixtureFaces.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "planogram_placements_product_fk",
      columns: [t.storeId, t.productId],
      foreignColumns: [products.storeId, products.id],
    }).onDelete("cascade"),
    // The face's own grid, overlap and stack limit are checked in code (faces can be under 24).
    check(
      "planogram_placements_ranges",
      sql`${t.col} between 0 and 47 and ${t.row} between 0 and 23 and ${t.colSpan} between 1 and 48 and ${t.rowSpan} between 1 and 24 and ${t.col} + ${t.colSpan} <= 48 and ${t.row} + ${t.rowSpan} <= 24 and ${t.pieceCount} between 1 and 99`,
    ),
    check("planogram_placements_depth", sql`${t.depth} between 0 and 98`),
  ],
);

/** A published version, frozen. Names are copied so it stays readable after deletes. */
export const planogramVersions = pgTable(
  "planogram_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: mapStoreId(),
    planogramId: uuid("planogram_id").notNull(),
    number: integer("number").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    // Copied at publish: app_store_user cannot read the user table.
    publishedByName: text("published_by_name").notNull(),
    summary: text("summary"),
    placements: jsonb("placements").$type<SnapshotEntry[]>().notNull(),
  },
  (t) => [
    index("planogram_versions_store_idx").on(t.storeId),
    uniqueIndex("planogram_versions_number_unique").on(t.planogramId, t.number),
    foreignKey({
      name: "planogram_versions_planogram_fk",
      columns: [t.storeId, t.planogramId],
      foreignColumns: [planograms.storeId, planograms.id],
    }).onDelete("cascade"),
    check("planogram_versions_number_positive", sql`${t.number} >= 1`),
  ],
);
