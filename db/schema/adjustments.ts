// ---------------------------------------------------------------------------
// Quick Adjust (docs/superpowers/specs/2026-11-17-0.7.0.9-quick-adjust-design.md §6.1): a
// temporary layer on a planogram's published version, for when a product sells out. An
// adjustment is pinned to the version it sits on; its changes each name one tile of that
// version (by its snapshot fields: snapshot entries have no id) and swap its product or leave
// it empty. At most one draft and one published adjustment per planogram. Ended ones are kept
// as the record. Grants and RLS are added by hand in 0019, as in 0009.
// ---------------------------------------------------------------------------

import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

import { mapCreatedAt, mapStoreId, mapUpdatedAt, mapVersion } from "./columns";
import { fixtureFaces } from "./fixtures";
import { presentation } from "./library";
import { planograms } from "./planograms";
import { products } from "./products";

export const adjustmentState = pgEnum("adjustment_state", ["draft", "published", "ended"]);
export const adjustmentChange = pgEnum("adjustment_change", ["replace", "empty"]);

export const planogramAdjustments = pgTable(
  "planogram_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: mapStoreId(),
    planogramId: uuid("planogram_id").notNull(),
    // The published number this layer sits on.
    basedOnVersion: integer("based_on_version").notNull(),
    state: adjustmentState("state").notNull().default("draft"),
    // Why it ended: reverted by hand, superseded by a newer adjustment, or ended by a full publish.
    endedReason: text("ended_reason"),
    // Copied at creation and publish: app_store_user cannot read the user table.
    createdByName: text("created_by_name").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    publishedByName: text("published_by_name"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    // The target of the changes' (store_id, adjustment_id) composite FK.
    uniqueIndex("planogram_adjustments_store_id_unique").on(t.storeId, t.id),
    index("planogram_adjustments_store_idx").on(t.storeId),
    index("planogram_adjustments_planogram_idx").on(t.planogramId),
    // One draft and one published adjustment per planogram: the indexes decide a race.
    uniqueIndex("planogram_adjustments_one_draft").on(t.planogramId).where(sql`${t.state} = 'draft'`),
    uniqueIndex("planogram_adjustments_one_published").on(t.planogramId).where(sql`${t.state} = 'published'`),
    foreignKey({
      name: "planogram_adjustments_planogram_fk",
      columns: [t.storeId, t.planogramId],
      foreignColumns: [planograms.storeId, planograms.id],
    }).onDelete("cascade"),
    check("planogram_adjustments_based_on", sql`${t.basedOnVersion} >= 1`),
    check("planogram_adjustments_ended_reason", sql`(${t.endedReason} is not null) = (${t.state} = 'ended')`),
    check("planogram_adjustments_ended_reason_known", sql`${t.endedReason} in ('reverted', 'superseded', 'new_version')`),
  ],
);

export const planogramAdjustmentChanges = pgTable(
  "planogram_adjustment_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: mapStoreId(),
    adjustmentId: uuid("adjustment_id").notNull(),
    kind: adjustmentChange("kind").notNull(),
    // The target tile, as it sits in the based-on version.
    faceId: uuid("face_id").notNull(),
    targetProductId: uuid("target_product_id").notNull(),
    presentation: presentation("presentation").notNull(),
    col: integer("col").notNull(),
    row: integer("row").notNull(),
    colSpan: integer("col_span").notNull(),
    rowSpan: integer("row_span").notNull(),
    depth: integer("depth").notNull().default(0),
    // A replacement brings its own product and footprint; a tile left empty has none.
    replacementProductId: uuid("replacement_product_id"),
    replacementColSpan: integer("replacement_col_span"),
    replacementRowSpan: integer("replacement_row_span"),
    // Copied from the target.
    pieceCount: integer("piece_count").notNull().default(1),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    index("planogram_adjustment_changes_store_idx").on(t.storeId),
    // One change per target; also serves the lookups by adjustment.
    uniqueIndex("planogram_adjustment_changes_target_unique").on(t.adjustmentId, t.faceId, t.col, t.row, t.depth, t.targetProductId),
    foreignKey({
      name: "planogram_adjustment_changes_adjustment_fk",
      columns: [t.storeId, t.adjustmentId],
      foreignColumns: [planogramAdjustments.storeId, planogramAdjustments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "planogram_adjustment_changes_face_fk",
      columns: [t.storeId, t.faceId],
      foreignColumns: [fixtureFaces.storeId, fixtureFaces.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "planogram_adjustment_changes_target_fk",
      columns: [t.storeId, t.targetProductId],
      foreignColumns: [products.storeId, products.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "planogram_adjustment_changes_replacement_fk",
      columns: [t.storeId, t.replacementProductId],
      foreignColumns: [products.storeId, products.id],
    }).onDelete("cascade"),
    check(
      "planogram_adjustment_changes_ranges",
      sql`${t.col} between 0 and 47 and ${t.row} between 0 and 23 and ${t.colSpan} between 1 and 48 and ${t.rowSpan} between 1 and 24 and ${t.col} + ${t.colSpan} <= 48 and ${t.row} + ${t.rowSpan} <= 24 and ${t.pieceCount} between 1 and 99 and ${t.replacementColSpan} between 1 and 48 and ${t.replacementRowSpan} between 1 and 24`,
    ),
    check("planogram_adjustment_changes_depth", sql`${t.depth} between 0 and 98`),
    check(
      "planogram_adjustment_changes_replacement",
      sql`(${t.kind} = 'replace' and ${t.replacementProductId} is not null and ${t.replacementColSpan} is not null and ${t.replacementRowSpan} is not null) or (${t.kind} = 'empty' and ${t.replacementProductId} is null and ${t.replacementColSpan} is null and ${t.replacementRowSpan} is null)`,
    ),
  ],
);
