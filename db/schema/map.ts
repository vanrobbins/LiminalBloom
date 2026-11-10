// ---------------------------------------------------------------------------
// The store map (docs/superpowers/specs/2026-09-30-store-map-design.md §5).
//
// Every length is whole inches; rotation is whole degrees. Each row carries
// its store and a version that every save bumps, so two devices editing the
// same item can be told apart (spec §8). Row-level security on these six
// tables is added by hand in migration 0005.
// ---------------------------------------------------------------------------

import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import type { Point } from "@/lib/layout/types";

import { organization } from "../auth-schema";

import { mapCreatedAt, mapStoreId, mapUpdatedAt, mapVersion } from "./columns";

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
  // A frame with one hanging rail (Week 6.5 frame racks spec §2).
  "frame_rack",
]);
export const faceSide = pgEnum("face_side", ["front", "back", "left", "right", "top"]);
export const tableSide = pgEnum("table_side", ["front", "back", "left", "right"]);

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
  (t) => [
    // The target of fixtures' and stockroom_bins' (store_id, zone_id) composite FKs.
    uniqueIndex("zones_store_id_unique").on(t.storeId, t.id),
    index("zones_store_idx").on(t.storeId),
  ],
);
