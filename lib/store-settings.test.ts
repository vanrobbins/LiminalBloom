// Store settings under row-level security, and who may change the time zone (the
// store.settings switch, held by a real role), against the dev database (like
// lib/planograms/rls.test.ts).

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { roleDefinitions, storeSettings } from "@/db/schema";
import { dropPeople, makePerson, makeStoreWithRoles, type StoreRoles } from "@/lib/access/test-roles";
import { withStore } from "@/lib/db/with-store";
import { dropStores, makeStore } from "@/lib/products/test-stores";
import { canonicalZone } from "@/lib/time/zones";

import { setStoreTimezone, storeSettingsFor, storeTimezone } from "./store-settings";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

async function storeWithZone(label: string, timezone = "America/Los_Angeles"): Promise<{ store: string; roles: StoreRoles }> {
  const made = await makeStoreWithRoles(label);
  await db.insert(storeSettings).values({ storeId: made.store, timezone });
  return made;
}

/** A person holding the given role (a key of StoreRoles), or none. */
async function person(made: { store: string; roles: StoreRoles }, role: keyof StoreRoles | null): Promise<string> {
  return (await makePerson(made.store, role ? made.roles[role] : null)).userId;
}

describe("store settings", () => {
  it("shows only the scoped store's row, even without a filter", async () => {
    const { store: a } = await storeWithZone("tz-rls-a", "America/Denver");
    await storeWithZone("tz-rls-b", "America/Chicago");
    const [rows] = await withStore(a, [db.select().from(storeSettings)] as const);
    expect(rows.map((r) => r.timezone)).toEqual(["America/Denver"]);
  });

  it("falls back to Pacific for a store with no row", async () => {
    expect(await storeTimezone(await makeStore("tz-none"))).toBe("America/Los_Angeles");
  });

  it("lets a Store Manager change the zone, and nobody whose role lacks store.settings", async () => {
    const made = await storeWithZone("tz-roles");
    const { store } = made;
    const manager = await person(made, "store_manager");
    expect(await setStoreTimezone(store, manager, "America/Denver", 1)).toEqual({ status: "saved" });
    expect(await storeSettingsFor(store)).toEqual({ timezone: "America/Denver", version: 2 });

    for (const role of ["assistant_manager", "vm_manager", "vm_worker", "sales_associate", null] as const) {
      const who = await person(made, role);
      expect(await setStoreTimezone(store, who, "America/Chicago", 2), String(role)).toEqual({ status: "forbidden" });
    }
    expect(await storeTimezone(store)).toBe("America/Denver");
  });

  it("follows the switch, not the role: a role given store.settings may change the zone", async () => {
    const made = await storeWithZone("tz-switch");
    const assistant = await person(made, "assistant_manager");
    expect(await setStoreTimezone(made.store, assistant, "America/Denver", 1)).toEqual({ status: "forbidden" });
    const [row] = await db.select({ switches: roleDefinitions.switches }).from(roleDefinitions).where(eq(roleDefinitions.id, made.roles.assistant_manager));
    await db.update(roleDefinitions).set({ switches: [...row.switches, "store.settings"] }).where(eq(roleDefinitions.id, made.roles.assistant_manager));
    expect(await setStoreTimezone(made.store, assistant, "America/Denver", 1)).toEqual({ status: "saved" });
  });

  it("refuses an unknown zone and a stale version", async () => {
    const made = await storeWithZone("tz-refuse");
    const { store } = made;
    const owner = await person(made, "store_manager");
    expect(await setStoreTimezone(store, owner, "Mars/Olympus", 1)).toEqual({ status: "invalid" });
    expect(await setStoreTimezone(store, owner, "America/Denver", 1)).toEqual({ status: "saved" });
    expect(await setStoreTimezone(store, owner, "America/Chicago", 1)).toEqual({ status: "conflict" });
    expect(await storeTimezone(store)).toBe("America/Denver");
  });

  it("stores the runtime's spelling of a zone the browser spelled differently", async () => {
    const made = await storeWithZone("tz-alias");
    const { store } = made;
    const owner = await person(made, "store_manager");
    expect(await setStoreTimezone(store, owner, "America/Indiana/Indianapolis", 1)).toEqual({ status: "saved" });
    expect((await storeSettingsFor(store))?.timezone).toBe(canonicalZone("America/Indiana/Indianapolis"));
    expect(await setStoreTimezone(store, owner, "america/denver", 2)).toEqual({ status: "saved" });
    expect((await storeSettingsFor(store))?.timezone).toBe("America/Denver");
  });

  it("makes the row for a store that has none (version 0), once", async () => {
    const made = await makeStoreWithRoles("tz-norow");
    const { store } = made;
    const owner = await person(made, "store_manager");
    const plain = await person(made, "sales_associate");
    expect(await setStoreTimezone(store, plain, "America/Denver", 0)).toEqual({ status: "forbidden" });
    expect(await storeSettingsFor(store)).toBeNull();
    expect(await setStoreTimezone(store, owner, "America/Denver", 0)).toEqual({ status: "saved" });
    expect(await storeSettingsFor(store)).toEqual({ timezone: "America/Denver", version: 1 });
    // The row exists now, so "no row yet" is stale.
    expect(await setStoreTimezone(store, owner, "America/Chicago", 0)).toEqual({ status: "conflict" });
    expect(await storeTimezone(store)).toBe("America/Denver");
  });

  it("never lets one store's member change another store", async () => {
    const mine = await storeWithZone("tz-mine");
    const theirs = await storeWithZone("tz-theirs");
    const owner = await person(mine, "store_manager");
    expect(await setStoreTimezone(theirs.store, owner, "America/Denver", 1)).toEqual({ status: "forbidden" });
    expect(await storeTimezone(theirs.store)).toBe("America/Los_Angeles");
  });
});
