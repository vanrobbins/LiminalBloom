// Store settings under row-level security, and who may change the time zone,
// against the dev database (like lib/planograms/rls.test.ts).

import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { storeSettings } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { canManageStore, setStoreTimezone, storeSettingsFor, storeTimezone } from "./store-settings";

const users: string[] = [];
afterAll(async () => {
  await dropStores();
  if (users.length) await db.delete(user).where(inArray(user.id, users));
});

async function person(storeId: string, role: string): Promise<string> {
  const id = `test_tz_${randomUUID().slice(0, 8)}`;
  users.push(id);
  await db.insert(user).values({ id, name: role, email: `${id}@example.com` });
  await db.insert(member).values({ id: randomUUID(), organizationId: storeId, userId: id, role, createdAt: new Date() });
  return id;
}

async function storeWithZone(label: string, timezone = "America/Los_Angeles") {
  const store = await makeStore(label);
  await db.insert(storeSettings).values({ storeId: store, timezone });
  return store;
}

describe("store settings", () => {
  it("shows only the scoped store's row, even without a filter", async () => {
    const a = await storeWithZone("tz-rls-a", "America/Denver");
    await storeWithZone("tz-rls-b", "America/Chicago");
    const [rows] = await withStore(a, [db.select().from(storeSettings)] as const);
    expect(rows.map((r) => r.timezone)).toEqual(["America/Denver"]);
  });

  it("falls back to Pacific for a store with no row", async () => {
    expect(await storeTimezone(await makeStore("tz-none"))).toBe("America/Los_Angeles");
  });

  it("lets an owner or admin change the zone, never a member", async () => {
    const store = await storeWithZone("tz-roles");
    const owner = await person(store, "owner");
    const admin = await person(store, "admin");
    const plain = await person(store, "member");
    expect(await canManageStore(owner, store)).toBe(true);
    expect(await canManageStore(admin, store)).toBe(true);
    expect(await canManageStore(plain, store)).toBe(false);
    expect(await setStoreTimezone(store, plain, "America/Denver", 1)).toEqual({ status: "forbidden" });
    expect(await setStoreTimezone(store, owner, "America/Denver", 1)).toEqual({ status: "saved" });
    expect(await storeSettingsFor(store)).toEqual({ timezone: "America/Denver", version: 2 });
  });

  it("refuses an unknown zone and a stale version", async () => {
    const store = await storeWithZone("tz-refuse");
    const owner = await person(store, "owner");
    expect(await setStoreTimezone(store, owner, "Mars/Olympus", 1)).toEqual({ status: "invalid" });
    expect(await setStoreTimezone(store, owner, "America/Denver", 1)).toEqual({ status: "saved" });
    expect(await setStoreTimezone(store, owner, "America/Chicago", 1)).toEqual({ status: "conflict" });
    expect(await storeTimezone(store)).toBe("America/Denver");
  });

  it("never lets one store's member change another store", async () => {
    const mine = await storeWithZone("tz-mine");
    const theirs = await storeWithZone("tz-theirs");
    const owner = await person(mine, "owner");
    expect(await setStoreTimezone(theirs, owner, "America/Denver", 1)).toEqual({ status: "forbidden" });
  });
});
