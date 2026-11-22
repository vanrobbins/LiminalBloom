// Saving against the real dev database (spec §11): versions, the gap race,
// invalid results, and store isolation through RLS.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { withStore } from "@/lib/db/with-store";
import { organization } from "@/db/auth-schema";
import { fixtures, zones } from "@/db/schema";

import { diff, emptyChanges } from "./diff";
import { rectanglePoints } from "./factories";
import { loadLayout } from "./load";
import { applyLayoutChanges, conflictLabel, conflictsFrom, isDuplicateId } from "./save";
import { writeStatements } from "./write";
import { EMPTY_LAYOUT, type Fixture, type Layout, type Zone } from "./types";

const created: string[] = [];

async function makeStore(label: string): Promise<string> {
  const id = `test_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(organization).values({ id, name: `Test store ${label}`, slug: id, createdAt: new Date() });
  created.push(id);
  return id;
}

afterAll(async () => {
  for (const id of created) await db.delete(organization).where(eq(organization.id, id));
});

const withOutline: Layout = { ...EMPTY_LAYOUT, outline: { points: rectanglePoints(480, 360), version: 0 } };
const newZone = (over: Partial<Zone> = {}): Zone => ({
  id: randomUUID(),
  name: "Front tables",
  type: "display",
  color: "zone-1",
  points: rectanglePoints(120, 120, { x: 12, y: 12 }),
  version: 0,
  ...over,
});

describe("the in-batch version guard", () => {
  // applyLayoutChanges checks versions first, so only a save that loses the
  // race between loadLayout and the batch reaches layout_assert. Run the
  // statements directly, built from a stale `current`, to prove the guard.
  it("refuses a guarded update from a stale read and writes nothing", async () => {
    const store = await makeStore("guard-update");
    await applyLayoutChanges(store, diff(EMPTY_LAYOUT, { ...withOutline, zones: [newZone()] }));
    const current = await loadLayout(store);
    await applyLayoutChanges(store, diff(current, { ...current, zones: [{ ...current.zones[0], name: "Theirs" }] }));

    const mine = diff(current, { ...current, zones: [{ ...current.zones[0], name: "Mine" }] });
    const error = await withStore(store, writeStatements(store, mine, current) as [BatchItem<"pg">, ...BatchItem<"pg">[]]).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).not.toBeNull();
    expect(conflictLabel(error)).toBe(current.zones[0].id);
    expect((await loadLayout(store)).zones[0].name).toBe("Theirs");
  });

  it("refuses a guarded delete from a stale read and keeps the row", async () => {
    const store = await makeStore("guard-delete");
    await applyLayoutChanges(store, diff(EMPTY_LAYOUT, { ...withOutline, zones: [newZone()] }));
    const current = await loadLayout(store);
    await applyLayoutChanges(store, diff(current, { ...current, zones: [{ ...current.zones[0], name: "Theirs" }] }));

    const mine = diff(current, { ...current, zones: [] });
    const error = await withStore(store, writeStatements(store, mine, current) as [BatchItem<"pg">, ...BatchItem<"pg">[]]).then(
      () => null,
      (e: unknown) => e,
    );
    expect(conflictLabel(error)).toBe(current.zones[0].id);
    expect((await loadLayout(store)).zones).toHaveLength(1);
  });
});

describe("isDuplicateId", () => {
  it("treats only primary-key violations as a reused id", () => {
    const dup = (constraint: string) =>
      new Error("Failed query", { cause: new Error(`duplicate key value violates unique constraint "${constraint}"`) });
    expect(isDuplicateId(dup("zones_pkey"))).toBe(true);
    expect(isDuplicateId(dup("fixture_faces_side_unique"))).toBe(false);
    expect(isDuplicateId(new Error("something else"))).toBe(false);
  });
});

describe("cross-store update", () => {
  it("ignores another store's zone id on an update to this store's own fixture", async () => {
    const a = await makeStore("xupd-a");
    const b = await makeStore("xupd-b");
    const bZone = newZone();
    await applyLayoutChanges(b, diff(EMPTY_LAYOUT, { ...withOutline, zones: [bZone] }));
    const rack: Fixture = { id: randomUUID(), zoneId: null, type: "prop", name: "Plant", x: 400, y: 300, width: 24, depth: 24, rotation: 0, curve: 0, tableSetId: null, setSide: null, runId: null, runIndex: null, version: 0 };
    await applyLayoutChanges(a, diff(EMPTY_LAYOUT, { ...withOutline, fixtures: [rack] }));
    const saved = await loadLayout(a);
    await applyLayoutChanges(a, diff(saved, { ...saved, fixtures: [{ ...saved.fixtures[0], zoneId: bZone.id }] }));
    const [row] = await db.select().from(fixtures).where(eq(fixtures.id, rack.id));
    expect(row.storeId).toBe(a);
    expect(row.zoneId).toBeNull();
  });
});

describe("deleting a zone", () => {
  // The (store_id, zone_id) FK must null only zone_id; a bare SET NULL would
  // null store_id too and the delete would fail on its NOT NULL (0008).
  it("keeps the fixtures in it, now without a zone", async () => {
    const store = await makeStore("zone-del");
    const zone = newZone();
    await db.insert(zones).values({ ...zone, storeId: store });
    const rackId = randomUUID();
    await db.insert(fixtures).values({ id: rackId, storeId: store, zoneId: zone.id, type: "prop", name: "Plant", x: 24, y: 24, width: 24, depth: 24 });

    await db.delete(zones).where(eq(zones.id, zone.id));

    const [row] = await db.select().from(fixtures).where(eq(fixtures.id, rackId));
    expect(row).toMatchObject({ storeId: store, zoneId: null });
  });
});

describe("conflictsFrom", () => {
  const dup = (constraint: string) =>
    new Error("Failed query", { cause: new Error(`duplicate key value violates unique constraint "${constraint}"`) });

  it("turns two devices attaching a lower table to the same table into a conflict on that table", () => {
    const writes = emptyChanges();
    writes.tableSets.push({
      item: { id: "set-1", upperFixtureId: "upper-1", version: 0 },
      expectedVersion: null,
    });
    expect(conflictsFrom(dup("table_sets_upper_fixture_id_unique"), writes)).toEqual(["upper-1", "set-1"]);
  });

  it("keeps the other cases as they were", () => {
    expect(conflictsFrom(new Error("Failed query", { cause: new Error("layout_conflict:abc") }), emptyChanges())).toEqual(["abc"]);
    expect(conflictsFrom(dup("zones_pkey"), emptyChanges())).toEqual([]);
    expect(conflictsFrom(dup("fixture_faces_side_unique"), emptyChanges())).toBeNull();
  });
});
