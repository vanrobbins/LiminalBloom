// Frame rack runs against the dev database (frame racks spec §8): migration
// 0013's checks, row-level security on frame_runs, the composite key, saving
// a run, and the planogram following the anchor.

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { fixtures, frameRuns, planograms } from "@/db/schema";
import { dbRefusal } from "@/lib/db/test-errors";
import { withStore } from "@/lib/db/with-store";

import { apply } from "./commands";
import { diff } from "./diff";
import { rectanglePoints } from "./factories";
import { loadLayout } from "./load";
import { TWO_PLANOGRAMS, applyLayoutChanges } from "./save";
import { EMPTY_LAYOUT, type Fixture, type Layout } from "./types";

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

const rack = (x: number, over: Partial<Fixture> = {}): Fixture => ({
  id: randomUUID(), zoneId: null, type: "frame_rack", name: `Frame rack ${x}`, x, y: 120, width: 48, depth: 24, rotation: 0, curve: 0,
  tableSetId: null, setSide: null, runId: null, runIndex: null, version: 0, ...over,
});
const base: Layout = { ...EMPTY_LAYOUT, outline: { points: rectanglePoints(480, 360), version: 0 } };
const rail = (f: Fixture) => ({ id: randomUUID(), fixtureId: f.id, side: "front" as const, columns: 8, rows: 1, version: 0 });

async function savedRun(store: string, count: number): Promise<Layout> {
  const first = rack(100);
  let layout: Layout = { ...base, fixtures: [first], faces: [rail(first)] };
  for (let i = 1; i < count; i++) layout = apply(layout, { type: "addRackToRun", rackId: layout.fixtures.at(-1)!.id, side: "right" }, randomUUID);
  expect((await applyLayoutChanges(store, diff(EMPTY_LAYOUT, layout))).status).toBe("saved");
  return loadLayout(store);
}

describe("migration 0013", () => {
  it("refuses a rack with a run but no index, a non-frame-rack in a run, and a 7th index", async () => {
    const store = await makeStore("run-checks");
    const [run] = await db.insert(frameRuns).values({ id: randomUUID(), storeId: store }).returning();
    const row = (over: object) => ({ id: randomUUID(), storeId: store, type: "frame_rack" as const, name: "R", x: 0, y: 0, width: 48, depth: 24, ...over });
    expect(await dbRefusal(db.insert(fixtures).values(row({ runId: run.id })))).toMatch(/"fixtures_run_has_index"/);
    expect(await dbRefusal(db.insert(fixtures).values(row({ runId: run.id, runIndex: 0, type: "rack" })))).toMatch(/"fixtures_run_frame_rack"/);
    expect(await dbRefusal(db.insert(fixtures).values(row({ runId: run.id, runIndex: 6 })))).toMatch(/"fixtures_run_index_range"/);
    await db.insert(fixtures).values(row({ runId: run.id, runIndex: 0 }));
  });

  it("refuses another store's run, and nulls a rack's run when the run goes", async () => {
    const a = await makeStore("run-a");
    const b = await makeStore("run-b");
    const [run] = await db.insert(frameRuns).values({ id: randomUUID(), storeId: b }).returning();
    const row = { storeId: a, type: "frame_rack" as const, name: "R", x: 0, y: 0, width: 48, depth: 24, runIndex: 0 };
    expect(await dbRefusal(db.insert(fixtures).values({ id: randomUUID(), ...row, runId: run.id }))).toMatch(/"fixtures_run_fk"/);
    const [own] = await db.insert(frameRuns).values({ id: randomUUID(), storeId: a }).returning();
    const id = randomUUID();
    await db.insert(fixtures).values({ id, ...row, runId: own.id });
    await db.delete(frameRuns).where(eq(frameRuns.id, own.id));
    const [left] = await db.select({ runId: fixtures.runId }).from(fixtures).where(eq(fixtures.id, id));
    expect(left.runId).toBeNull();
  });

  it("hides another store's runs (row-level security)", async () => {
    const a = await makeStore("run-rls-a");
    const b = await makeStore("run-rls-b");
    await db.insert(frameRuns).values({ id: randomUUID(), storeId: b });
    const [, rows] = await withStore(a, [db.execute(sql`select 1`), db.select().from(frameRuns)] as const);
    expect(rows).toEqual([]);
  });
});

describe("saving runs", () => {
  it("saves and loads a run, and re-indexes it in one save when the anchor leaves", async () => {
    const store = await makeStore("run-save");
    const layout = await savedRun(store, 3);
    expect(layout.frameRuns).toHaveLength(1);
    const [a, b, c] = [...layout.fixtures].sort((x, y) => (x.runIndex ?? 0) - (y.runIndex ?? 0));
    await db.insert(planograms).values({ id: randomUUID(), storeId: store, fixtureId: a.id });

    const out = apply(layout, { type: "removeFromRun", rackId: a.id }, randomUUID);
    expect((await applyLayoutChanges(store, diff(layout, out))).status).toBe("saved");
    const reloaded = await loadLayout(store);
    expect(reloaded.fixtures.find((f) => f.id === b.id)?.runIndex).toBe(0);
    expect(reloaded.fixtures.find((f) => f.id === c.id)?.runIndex).toBe(1);
    const [row] = await db.select({ fixtureId: planograms.fixtureId }).from(planograms).where(eq(planograms.storeId, store));
    expect(row.fixtureId).toBe(b.id);
  });

  it("refuses to link racks when two of them have planograms", async () => {
    const store = await makeStore("run-two");
    const [a, b] = [rack(100), rack(148)];
    const layout: Layout = { ...base, fixtures: [a, b], faces: [rail(a), rail(b)] };
    expect((await applyLayoutChanges(store, diff(EMPTY_LAYOUT, layout))).status).toBe("saved");
    await db.insert(planograms).values([
      { id: randomUUID(), storeId: store, fixtureId: a.id },
      { id: randomUUID(), storeId: store, fixtureId: b.id },
    ]);
    const saved = await loadLayout(store);
    const linked = apply(saved, { type: "linkRun", ids: [a.id, b.id] }, randomUUID);
    const result = await applyLayoutChanges(store, diff(saved, linked));
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") expect(result.issues[0].message).toBe(TWO_PLANOGRAMS);
  });

  it("moves a planogram to the anchor when its rack joins a run behind it", async () => {
    const store = await makeStore("run-join");
    const [a, b] = [rack(100), rack(148)];
    const layout: Layout = { ...base, fixtures: [a, b], faces: [rail(a), rail(b)] };
    await applyLayoutChanges(store, diff(EMPTY_LAYOUT, layout));
    await db.insert(planograms).values({ id: randomUUID(), storeId: store, fixtureId: b.id });
    const saved = await loadLayout(store);
    const linked = apply(saved, { type: "linkRun", ids: [a.id, b.id] }, randomUUID);
    expect((await applyLayoutChanges(store, diff(saved, linked))).status).toBe("saved");
    const [row] = await db.select({ fixtureId: planograms.fixtureId }).from(planograms).where(eq(planograms.storeId, store));
    expect(row.fixtureId).toBe(a.id);
  });
});
