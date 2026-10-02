// The statements that write one save, in an order that never trips a foreign
// key, a cascade or the one-grid-per-side index (plan Task 17). Every update
// and delete is guarded by the version the browser expected: if another save
// got there first, the guard matches no row, layout_assert raises, and the
// whole batch rolls back (spec §8 step 6).

import "server-only";

import { and, eq, sql, type SQLWrapper } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { entrances, fixtureFaces, fixtures, storeLayouts, tableSets, zones } from "@/db/schema";

import type { ChangeSet, Upsert } from "./diff";
import type { Entrance, Face, Fixture, Layout, TableSet, Zone } from "./types";

// Drizzle already wraps an interpolated query builder in parentheses (plan
// Task 1 spike), so the builder goes in bare: "as (${query})" would be a
// syntax error.
function guarded(query: SQLWrapper, label: string): BatchItem<"pg"> {
  return db.execute(sql`with changed as ${query} select layout_assert((select count(*) from changed) = 1, ${label})`);
}

const inserts = <T>(list: Upsert<T>[]) => list.filter((u) => u.expectedVersion === null).map((u) => u.item);
const updates = <T>(list: Upsert<T>[]) =>
  list.filter((u): u is { item: T; expectedVersion: number } => u.expectedVersion !== null);

const zoneRow = (z: Zone) => ({ name: z.name, type: z.type, color: z.color, points: z.points });
const entranceRow = (e: Entrance) => ({ x: e.x, y: e.y, width: e.width });
const fixtureRow = (f: Fixture) => ({
  zoneId: f.zoneId,
  type: f.type,
  name: f.name,
  x: f.x,
  y: f.y,
  width: f.width,
  depth: f.depth,
  rotation: f.rotation,
  tableSetId: f.tableSetId,
  setSide: f.setSide,
});
const faceRow = (f: Face) => ({ fixtureId: f.fixtureId, side: f.side, columns: f.columns, rows: f.rows });
const setRow = (s: TableSet) => ({ upperFixtureId: s.upperFixtureId });

export function writeStatements(storeId: string, changes: ChangeSet, current: Layout): BatchItem<"pg">[] {
  const statements: BatchItem<"pg">[] = [];
  const now = new Date();
  const lowerIds = new Set(current.fixtures.filter((f) => f.tableSetId !== null).map((f) => f.id));
  const deletes = (collection: ChangeSet["deletes"][number]["collection"], lower?: boolean) =>
    changes.deletes.filter(
      (d) => d.collection === collection && (lower === undefined || lowerIds.has(d.id) === lower),
    );

  // 1–3. Children first, so nothing is cascaded away before its own guard runs.
  for (const d of deletes("faces")) {
    statements.push(guarded(db.delete(fixtureFaces).where(and(eq(fixtureFaces.id, d.id), eq(fixtureFaces.storeId, storeId), eq(fixtureFaces.version, d.expectedVersion))).returning({ id: fixtureFaces.id }), d.id));
  }
  for (const d of deletes("fixtures", true)) {
    statements.push(guarded(db.delete(fixtures).where(and(eq(fixtures.id, d.id), eq(fixtures.storeId, storeId), eq(fixtures.version, d.expectedVersion))).returning({ id: fixtures.id }), d.id));
  }
  for (const d of deletes("tableSets")) {
    statements.push(guarded(db.delete(tableSets).where(and(eq(tableSets.id, d.id), eq(tableSets.storeId, storeId), eq(tableSets.version, d.expectedVersion))).returning({ id: tableSets.id }), d.id));
  }

  // 4. The outline.
  if (changes.outline) {
    const { item, expectedVersion } = changes.outline;
    statements.push(
      expectedVersion === null
        ? db.insert(storeLayouts).values({ storeId, outline: item.points })
        : guarded(
            db
              .update(storeLayouts)
              .set({ outline: item.points, version: sql`${storeLayouts.version} + 1`, updatedAt: now })
              .where(and(eq(storeLayouts.storeId, storeId), eq(storeLayouts.version, expectedVersion)))
              .returning({ id: storeLayouts.storeId }),
            "outline",
          ),
    );
  }

  // 5. Inserts, parents before children. A reused id fails the primary key.
  for (const z of inserts(changes.zones)) statements.push(db.insert(zones).values({ id: z.id, storeId, ...zoneRow(z) }));
  for (const e of inserts(changes.entrances)) statements.push(db.insert(entrances).values({ id: e.id, storeId, ...entranceRow(e) }));
  const newFixtures = inserts(changes.fixtures);
  for (const f of newFixtures.filter((x) => x.tableSetId === null)) statements.push(db.insert(fixtures).values({ id: f.id, storeId, ...fixtureRow(f) }));
  for (const s of inserts(changes.tableSets)) statements.push(db.insert(tableSets).values({ id: s.id, storeId, ...setRow(s) }));
  for (const f of newFixtures.filter((x) => x.tableSetId !== null)) statements.push(db.insert(fixtures).values({ id: f.id, storeId, ...fixtureRow(f) }));
  for (const f of inserts(changes.faces)) statements.push(db.insert(fixtureFaces).values({ id: f.id, storeId, ...faceRow(f) }));

  // 6. Updates, each guarded by the version it was changed from.
  for (const { item, expectedVersion } of updates(changes.zones)) {
    statements.push(guarded(db.update(zones).set({ ...zoneRow(item), version: sql`${zones.version} + 1`, updatedAt: now }).where(and(eq(zones.id, item.id), eq(zones.storeId, storeId), eq(zones.version, expectedVersion))).returning({ id: zones.id }), item.id));
  }
  for (const { item, expectedVersion } of updates(changes.entrances)) {
    statements.push(guarded(db.update(entrances).set({ ...entranceRow(item), version: sql`${entrances.version} + 1`, updatedAt: now }).where(and(eq(entrances.id, item.id), eq(entrances.storeId, storeId), eq(entrances.version, expectedVersion))).returning({ id: entrances.id }), item.id));
  }
  for (const { item, expectedVersion } of updates(changes.fixtures)) {
    statements.push(guarded(db.update(fixtures).set({ ...fixtureRow(item), version: sql`${fixtures.version} + 1`, updatedAt: now }).where(and(eq(fixtures.id, item.id), eq(fixtures.storeId, storeId), eq(fixtures.version, expectedVersion))).returning({ id: fixtures.id }), item.id));
  }
  for (const { item, expectedVersion } of updates(changes.faces)) {
    statements.push(guarded(db.update(fixtureFaces).set({ ...faceRow(item), version: sql`${fixtureFaces.version} + 1`, updatedAt: now }).where(and(eq(fixtureFaces.id, item.id), eq(fixtureFaces.storeId, storeId), eq(fixtureFaces.version, expectedVersion))).returning({ id: fixtureFaces.id }), item.id));
  }
  for (const { item, expectedVersion } of updates(changes.tableSets)) {
    statements.push(guarded(db.update(tableSets).set({ ...setRow(item), version: sql`${tableSets.version} + 1`, updatedAt: now }).where(and(eq(tableSets.id, item.id), eq(tableSets.storeId, storeId), eq(tableSets.version, expectedVersion))).returning({ id: tableSets.id }), item.id));
  }

  // 7. The rest of the deletes, after fixtures have been moved out of deleted zones.
  for (const d of deletes("fixtures", false)) {
    statements.push(guarded(db.delete(fixtures).where(and(eq(fixtures.id, d.id), eq(fixtures.storeId, storeId), eq(fixtures.version, d.expectedVersion))).returning({ id: fixtures.id }), d.id));
  }
  for (const d of deletes("zones")) {
    statements.push(guarded(db.delete(zones).where(and(eq(zones.id, d.id), eq(zones.storeId, storeId), eq(zones.version, d.expectedVersion))).returning({ id: zones.id }), d.id));
  }
  for (const d of deletes("entrances")) {
    statements.push(guarded(db.delete(entrances).where(and(eq(entrances.id, d.id), eq(entrances.storeId, storeId), eq(entrances.version, d.expectedVersion))).returning({ id: entrances.id }), d.id));
  }
  return statements;
}
