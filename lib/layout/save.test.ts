// Saving against the real dev database (spec §11): versions, the gap race,
// invalid results, and store isolation through RLS.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";

import { organization } from "@/db/auth-schema";
import { fixtureFaces, fixtures, tableSets, zones } from "@/db/schema";

import { diff } from "./diff";
import { rectanglePoints } from "./factories";
import { loadLayout } from "./load";
import { applyLayoutChanges, conflictLabel } from "./save";

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

describe("applyLayoutChanges", () => {
  it("saves an outline and a zone, then loads them back with version 1", async () => {
    const store = await makeStore("save-ok");
    const zone = newZone();
    const result = await applyLayoutChanges(store, diff(EMPTY_LAYOUT, { ...withOutline, zones: [zone] }));
    expect(result.status).toBe("saved");
    const loaded = await loadLayout(store);
    expect(loaded.outline?.version).toBe(1);
    expect(loaded.zones).toEqual([{ ...zone, version: 1 }]);
  });

  it("refuses a stale version and writes nothing", async () => {
    const store = await makeStore("save-stale");
    const zone = newZone();
    await applyLayoutChanges(store, diff(EMPTY_LAYOUT, { ...withOutline, zones: [zone] }));
    const saved = await loadLayout(store);
    // Another device renames it first.
    await applyLayoutChanges(store, diff(saved, { ...saved, zones: [{ ...saved.zones[0], name: "Theirs" }] }));
    // This device still thinks it is at version 1.
    const result = await applyLayoutChanges(store, diff(saved, { ...saved, zones: [{ ...saved.zones[0], name: "Mine" }] }));
    expect(result).toMatchObject({ status: "conflict", conflicts: [zone.id] });
    expect((await loadLayout(store)).zones[0].name).toBe("Theirs");
  });

  it("refuses an invalid result as a whole", async () => {
    const store = await makeStore("save-invalid");
    await applyLayoutChanges(store, diff(EMPTY_LAYOUT, withOutline));
    const saved = await loadLayout(store);
    const outside = newZone({ points: rectanglePoints(120, 120, { x: 400, y: 12 }) });
    const fine = newZone({ name: "Wall bays", points: rectanglePoints(60, 60, { x: 12, y: 200 }) });
    const result = await applyLayoutChanges(store, diff(saved, { ...saved, zones: [outside, fine] }));
    expect(result.status).toBe("invalid");
    expect((await loadLayout(store)).zones).toEqual([]);
  });

  it("cannot touch another store's items, even by id", async () => {
    const mine = await makeStore("save-mine");
    const theirs = await makeStore("save-theirs");
    const zone = newZone();
    await applyLayoutChanges(theirs, diff(EMPTY_LAYOUT, { ...withOutline, zones: [zone] }));
    await applyLayoutChanges(mine, diff(EMPTY_LAYOUT, withOutline));
    const saved = await loadLayout(mine);

    // Pretend their zone is ours and try to rename, then to re-insert it.
    const rename = await applyLayoutChanges(mine, diff({ ...saved, zones: [{ ...zone, version: 1 }] }, { ...saved, zones: [{ ...zone, name: "Hijacked", version: 1 }] }));
    expect(rename.status).toBe("conflict");
    const insert = await applyLayoutChanges(mine, diff(saved, { ...saved, zones: [zone] }));
    expect(insert.status).toBe("conflict");

    const [row] = await db.select().from(zones).where(eq(zones.id, zone.id));
    expect(row).toMatchObject({ storeId: theirs, name: "Front tables" });
  });

  it("switches a rack side off and on in one save", async () => {
    // Faces are deleted before inserted, so the one-grid-per-side index never trips.
    const store = await makeStore("save-faces");
    const rackId = randomUUID();
    const firstFace = randomUUID();
    const layout: Layout = {
      ...withOutline,
      fixtures: [{ id: rackId, zoneId: null, type: "rack", name: "Rack 1", x: 200, y: 200, width: 48, depth: 24, rotation: 0, curve: 0, tableSetId: null, setSide: null, runId: null, runIndex: null, version: 0 }],
      faces: [{ id: firstFace, fixtureId: rackId, side: "front", columns: 4, rows: 3, version: 0 }],
    };
    await applyLayoutChanges(store, diff(EMPTY_LAYOUT, layout));
    const saved = await loadLayout(store);
    const swapped = { ...saved, faces: [{ id: randomUUID(), fixtureId: rackId, side: "front" as const, columns: 6, rows: 2, version: 0 }] };
    expect((await applyLayoutChanges(store, diff(saved, swapped))).status).toBe("saved");
    expect((await loadLayout(store)).faces).toMatchObject([{ columns: 6, rows: 2 }]);
  });

  it("saves a curved wall bay, loads it curved, and refuses one past its limit", async () => {
    const store = await makeStore("save-curve");
    const bayId = randomUUID();
    const layout: Layout = {
      ...withOutline,
      fixtures: [{ id: bayId, zoneId: null, type: "wall_bay", name: "Curved wall", x: 200, y: 200, width: 120, depth: 24, rotation: 0, curve: -30, tableSetId: null, setSide: null, runId: null, runIndex: null, version: 0 }],
      faces: [{ id: randomUUID(), fixtureId: bayId, side: "front", columns: 20, rows: 5, version: 0 }],
    };
    expect((await applyLayoutChanges(store, diff(EMPTY_LAYOUT, layout))).status).toBe("saved");
    const saved = await loadLayout(store);
    expect(saved.fixtures[0].curve).toBe(-30);
    const tooFar = { ...saved, fixtures: [{ ...saved.fixtures[0], curve: -60 }] };
    expect((await applyLayoutChanges(store, diff(saved, tooFar))).status).not.toBe("saved");
    expect((await loadLayout(store)).fixtures[0].curve).toBe(-30);
  });
});

describe("conflictLabel", () => {
  it("finds the label anywhere in the cause chain", () => {
    const error = new Error("Failed query", { cause: new Error("layout_conflict:abc-123") });
    expect(conflictLabel(error)).toBe("abc-123");
    expect(conflictLabel(new Error("something else"))).toBeNull();
  });
});

describe("cross-store references", () => {
  // The foreign keys are single-column and run as the table owner, so they do
  // not stop a row in store A from pointing at store B. normalize() does: it
  // drops anything whose parent is not in this store's own layout and
  // recomputes zones from geometry.
  it("never links a row in one store to another store's ids", async () => {
    const a = await makeStore("xref-a");
    const b = await makeStore("xref-b");
    const bZone = newZone();
    const bUpper: Fixture = { id: randomUUID(), zoneId: bZone.id, type: "table", name: "Table B", x: 60, y: 60, width: 48, depth: 24, rotation: 0, curve: 0, tableSetId: null, setSide: null, runId: null, runIndex: null, version: 0 };
    const bSet = { id: randomUUID(), upperFixtureId: bUpper.id, version: 0 };
    const bLower: Fixture = { ...bUpper, id: randomUUID(), name: "Table B lower", y: 100, tableSetId: bSet.id, setSide: "front" };
    const bRack: Fixture = { ...bUpper, id: randomUUID(), type: "rack", name: "Rack B", x: 300, y: 250, zoneId: null };
    const bFace = { id: randomUUID(), fixtureId: bRack.id, side: "front" as const, columns: 4, rows: 3, version: 0 };
    await applyLayoutChanges(b, diff(EMPTY_LAYOUT, { ...withOutline, zones: [bZone] }));
    await db.insert(fixtures).values([bUpper, bRack].map(({ version, ...f }) => { void version; return { ...f, storeId: b }; }));
    await db.insert(tableSets).values({ id: bSet.id, storeId: b, upperFixtureId: bUpper.id });
    await db.insert(fixtures).values({ ...bLower, storeId: b });
    await db.insert(fixtureFaces).values({ ...bFace, storeId: b });

    await applyLayoutChanges(a, diff(EMPTY_LAYOUT, withOutline));
    const mine = await loadLayout(a);
    const aRack: Fixture = { ...bRack, id: randomUUID(), name: "Rack A", zoneId: bZone.id };
    const stolenLower: Fixture = { ...bLower, id: randomUUID(), name: "Stolen", tableSetId: bSet.id };
    const hijackSet = { id: randomUUID(), upperFixtureId: bUpper.id, version: 0 };
    const hijackLower: Fixture = { ...bLower, id: randomUUID(), name: "Hijack", tableSetId: hijackSet.id };
    const stolenFace = { id: randomUUID(), fixtureId: bRack.id, side: "back" as const, columns: 2, rows: 2, version: 0 };
    const next: Layout = {
      ...mine,
      fixtures: [aRack, stolenLower, hijackLower],
      tableSets: [hijackSet],
      faces: [{ id: randomUUID(), fixtureId: aRack.id, side: "front", columns: 2, rows: 2, version: 0 }, stolenFace],
    };
    const result = await applyLayoutChanges(a, diff(mine, next));
    expect(result.status).toBe("saved");

    const theirIds = new Set([bZone.id, bUpper.id, bLower.id, bRack.id, bSet.id, bFace.id]);
    const rows = {
      fixtures: await db.select().from(fixtures).where(eq(fixtures.storeId, a)),
      faces: await db.select().from(fixtureFaces).where(eq(fixtureFaces.storeId, a)),
      sets: await db.select().from(tableSets).where(eq(tableSets.storeId, a)),
    };
    expect(rows.fixtures.map((f) => f.name)).toEqual(["Rack A"]);
    for (const f of rows.fixtures) {
      expect(theirIds.has(f.zoneId ?? "")).toBe(false);
      expect(theirIds.has(f.tableSetId ?? "")).toBe(false);
    }
    expect(rows.faces.map((f) => f.fixtureId)).toEqual([aRack.id]);
    expect(rows.sets).toEqual([]);
  });
});
