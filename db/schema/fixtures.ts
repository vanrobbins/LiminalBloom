// Fixtures on the store map, their faces, table sets and runs (store map spec §5).

import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, foreignKey, index, integer, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { mapCreatedAt, mapStoreId, mapUpdatedAt, mapVersion } from "./columns";
import { faceSide, fixtureType, tableSide, zones } from "./map";

export const fixtures = pgTable(
  "fixtures",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    // Derived from the geometry on every save (spec §5); never trusted from a request.
    zoneId: uuid("zone_id"),
    type: fixtureType("type").notNull(),
    name: text("name").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    width: integer("width").notNull(),
    depth: integer("depth").notNull(),
    rotation: integer("rotation").notNull().default(0),
    // Wall bays only: inches from the line between the ends to the middle, + toward the front.
    curve: integer("curve").notNull().default(0),
    // Lower tables only. Deleting the set deletes them.
    tableSetId: uuid("table_set_id").references((): AnyPgColumn => tableSets.id, {
      onDelete: "cascade",
    }),
    setSide: tableSide("set_side"),
    // Frame racks joined end to end (frame racks spec §4.1). Index 0 is the
    // anchor, which holds the run's planogram. Geometry is read from positions.
    runId: uuid("run_id"),
    runIndex: integer("run_index"),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    // The target of fixture_faces' (store_id, fixture_id) composite FK.
    uniqueIndex("fixtures_store_id_unique").on(t.storeId, t.id),
    // A constraint, not an index, so migration 0014 can make it DEFERRABLE:
    // re-indexing a run in one save passes through duplicates mid-batch.
    unique("fixtures_run_index_unique").on(t.runId, t.runIndex),
    check("fixtures_run_index_range", sql`${t.runIndex} between 0 and 5`),
    // A deleted run nulls run_id only (the composite FK can't null run_index
    // too), so an index may outlive its run; the app ignores it then.
    check("fixtures_run_has_index", sql`${t.runId} is null or ${t.runIndex} is not null`),
    // Frame racks and wall bays join runs (run joins spec §2.1); one type per run is validate()'s.
    check("fixtures_run_type", sql`${t.runId} is null or ${t.type}::text in ('frame_rack', 'wall_bay')`),
    foreignKey({
      name: "fixtures_run_fk",
      columns: [t.storeId, t.runId],
      foreignColumns: [frameRuns.storeId, frameRuns.id],
    }).onDelete("set null"),
    index("fixtures_store_idx").on(t.storeId),
    check("fixtures_rotation_range", sql`${t.rotation} between 0 and 359`),
    check("fixtures_curve_range", sql`${t.curve} between -190 and 190`),
    check("fixtures_size_range", sql`${t.width} between 12 and 600 and ${t.depth} between 12 and 600`),
    // Composite FK: a fixture can only reference a zone in its own store.
    foreignKey({
      name: "fixtures_zone_fk",
      columns: [t.storeId, t.zoneId],
      foreignColumns: [zones.storeId, zones.id],
    }).onDelete("set null"),
  ],
);

/** A side of a fixture that displays product: half-foot columns, levels as rows. */
export const fixtureFaces = pgTable(
  "fixture_faces",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    fixtureId: uuid("fixture_id").notNull(),
    side: faceSide("side").notNull(),
    columns: integer("grid_columns").notNull(),
    rows: integer("grid_rows").notNull(),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    index("fixture_faces_store_idx").on(t.storeId),
    // The target of product_locations' (store_id, face_id) key.
    uniqueIndex("fixture_faces_store_id_unique").on(t.storeId, t.id),
    uniqueIndex("fixture_faces_side_unique").on(t.fixtureId, t.side),
    check("fixture_faces_grid_range", sql`${t.columns} between 1 and 48 and ${t.rows} between 1 and 24`),
    // Composite FK: a face can only reference a fixture in its own store.
    foreignKey({
      name: "fixture_faces_fixture_fk",
      columns: [t.storeId, t.fixtureId],
      foreignColumns: [fixtures.storeId, fixtures.id],
    }).onDelete("cascade"),
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

/** Frame racks joined end to end (frame racks spec §4.1). The racks name their run. */
export const frameRuns = pgTable(
  "frame_runs",
  {
    id: uuid("id").primaryKey(),
    storeId: mapStoreId(),
    /** Closed runs only: the rack the combined grid starts reading from. */
    startIndex: integer("start_index").notNull().default(0),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    index("frame_runs_store_idx").on(t.storeId),
    // The target of fixtures' (store_id, run_id) key: a rack joins only its own store's run.
    uniqueIndex("frame_runs_store_id_unique").on(t.storeId, t.id),
    check("frame_runs_start_range", sql`${t.startIndex} between 0 and 5`),
  ],
);
