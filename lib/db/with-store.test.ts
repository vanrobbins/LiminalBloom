// Row-level security for the store map (spec §8). Against the real dev
// database, because what is tested is Postgres itself refusing rows: a mock
// would only test the mock. Each test makes throwaway stores and deletes them.

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { zones } from "@/db/schema";

import { withStore } from "./with-store";

const created: string[] = [];

async function makeStore(label: string): Promise<string> {
  const id = `test_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(organization).values({ id, name: `Test store ${label}`, slug: id, createdAt: new Date() });
  created.push(id);
  return id;
}

async function makeZone(storeId: string, name: string): Promise<string> {
  const id = randomUUID();
  // As the owner, outside withStore: setup is allowed to write any store.
  await db.insert(zones).values({
    id,
    storeId,
    name,
    type: "display",
    color: "zone-1",
    points: [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 120 },
    ],
  });
  return id;
}

afterAll(async () => {
  for (const id of created) {
    await db.delete(organization).where(eq(organization.id, id));
  }
});

describe("withStore", () => {
  it("shows only the scoped store's rows, even without a store filter", async () => {
    const a = await makeStore("rls-a");
    const b = await makeStore("rls-b");
    await makeZone(a, "Zone A");
    await makeZone(b, "Zone B");

    // Deliberately no where clause: RLS alone must hide store B.
    const [rows] = await withStore(a, [db.select().from(zones)]);
    const stores = new Set(rows.map((row) => row.storeId));

    expect(stores.has(a)).toBe(true);
    expect(stores.has(b)).toBe(false);
  });

  it("cannot update another store's row", async () => {
    const a = await makeStore("rls-upd-a");
    const b = await makeStore("rls-upd-b");
    const zoneB = await makeZone(b, "Zone B");

    const [updated] = await withStore(a, [
      db.update(zones).set({ name: "Hijacked" }).where(eq(zones.id, zoneB)).returning({ id: zones.id }),
    ]);

    expect(updated).toEqual([]);
    const [row] = await db.select().from(zones).where(eq(zones.id, zoneB));
    expect(row.name).toBe("Zone B");
  });

  it("cannot insert a row into another store", async () => {
    const a = await makeStore("rls-ins-a");
    const b = await makeStore("rls-ins-b");

    await expect(
      withStore(a, [
        db.insert(zones).values({
          id: randomUUID(),
          storeId: b,
          name: "Smuggled",
          type: "display",
          color: "zone-1",
          points: [],
        }),
      ]),
    ).rejects.toThrow();
  });

  it("sees nothing at all when the role is set but no store is", async () => {
    const a = await makeStore("rls-none");
    await makeZone(a, "Zone A");

    const [, rows] = await db.batch([
      db.execute(sql`set local role app_store_user`),
      db.select().from(zones),
    ]);

    expect(rows).toEqual([]);
  });

  it("refuses an empty store id", async () => {
    await expect(withStore("", [db.select().from(zones)])).rejects.toThrow(/store id/);
  });
});
