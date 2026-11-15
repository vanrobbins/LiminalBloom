// The uniqueness, deferrable rank and CHECK rules on role_definitions
// (migration 0018), against the dev database. Each refusal names its constraint.

import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { roleDefinitions } from "@/db/schema";
import { dbRefusal } from "@/lib/db/test-errors";
import { withStore } from "@/lib/db/with-store";
import { dropStores } from "@/lib/products/test-stores";

import { makeStoreWithRoles } from "./test-roles";

afterAll(dropStores);

const custom = (storeId: string, name: string, rank: number) => ({ storeId, name, rank, switches: ["view"] });
const insert = (values: typeof roleDefinitions.$inferInsert) => db.insert(roleDefinitions).values(values);

describe("role_definitions uniqueness", () => {
  it("refuses a second role with the same name in a store, whatever its case, but not in another store", async () => {
    const a = await makeStoreWithRoles("rc-name-a");
    const b = await makeStoreWithRoles("rc-name-b");
    await insert(custom(a.store, "Floor Lead", 250));
    expect(await dbRefusal(insert(custom(a.store, "floor LEAD", 260)))).toMatch(/"role_definitions_name_unique"/);
    expect(await dbRefusal(insert(custom(a.store, "sales associate", 260)))).toMatch(/"role_definitions_name_unique"/);
    await insert(custom(b.store, "Floor Lead", 250));
  });

  it("refuses a second row for a built-in in one store, but allows any number of custom roles", async () => {
    const a = await makeStoreWithRoles("rc-builtin");
    expect(await dbRefusal(insert({ ...custom(a.store, "Second manager", 150), builtin: "store_manager" }))).toMatch(/"role_definitions_builtin_unique"/);
    await insert(custom(a.store, "Custom one", 150));
    await insert(custom(a.store, "Custom two", 160));
  });

  it("refuses two roles at one rank in a store, but not the same rank in another store", async () => {
    const a = await makeStoreWithRoles("rc-rank-a");
    const b = await makeStoreWithRoles("rc-rank-b");
    expect(await dbRefusal(insert(custom(a.store, "Tied with the manager", 100)))).toMatch(/"role_definitions_rank_unique"/);
    // Store B holds the same five ranks (made by the helper), so ranks are only unique within a store.
    await insert(custom(a.store, "Floor Lead", 250));
    await insert(custom(b.store, "Floor Lead", 250));
    const rows = await db.select().from(roleDefinitions).where(inArray(roleDefinitions.storeId, [a.store, b.store]));
    const floorLeads = rows.filter((r) => r.name === "Floor Lead");
    expect(floorLeads.map((r) => [r.rank, r.name])).toEqual([[250, "Floor Lead"], [250, "Floor Lead"]]);
    expect(new Set(floorLeads.map((r) => r.storeId))).toEqual(new Set([a.store, b.store]));
  });
});

describe("role_definitions ranks are deferrable", () => {
  async function twoCustomRoles(label: string) {
    const { store } = await makeStoreWithRoles(label);
    await insert(custom(store, "Lead", 250));
    await insert(custom(store, "Senior", 260));
    const lead = db.update(roleDefinitions).set({ rank: 260 }).where(and(eq(roleDefinitions.storeId, store), eq(roleDefinitions.name, "Lead")));
    const senior = db.update(roleDefinitions).set({ rank: 250 }).where(and(eq(roleDefinitions.storeId, store), eq(roleDefinitions.name, "Senior")));
    const swap = (deferred: boolean) =>
      deferred
        ? withStore(store, [db.execute(sql`set constraints role_definitions_rank_unique deferred`), lead, senior] as const)
        : withStore(store, [lead, senior] as const);
    const rankOf = async (name: string) => {
      const [row] = await db.select().from(roleDefinitions).where(and(eq(roleDefinitions.storeId, store), eq(roleDefinitions.name, name)));
      return row.rank;
    };
    return { swap, rankOf };
  }

  it("lets two roles swap ranks in one batch that defers the constraint", async () => {
    const { swap, rankOf } = await twoCustomRoles("rc-swap-yes");
    await swap(true);
    expect(await rankOf("Lead")).toBe(260);
    expect(await rankOf("Senior")).toBe(250);
  });

  it("refuses the same swap without deferring, and changes nothing", async () => {
    const { swap, rankOf } = await twoCustomRoles("rc-swap-no");
    expect(await dbRefusal(swap(false))).toMatch(/"role_definitions_rank_unique"/);
    expect(await rankOf("Lead")).toBe(250);
    expect(await rankOf("Senior")).toBe(260);
  });
});

describe("role_definitions CHECKs", () => {
  it("refuses a built-in value the app does not know", async () => {
    const a = await makeStoreWithRoles("rc-chk-builtin");
    expect(await dbRefusal(insert({ ...custom(a.store, "Owner", 50), builtin: "owner" }))).toMatch(/"role_definitions_builtin_known"/);
  });

  it("refuses a rank of zero or less", async () => {
    const a = await makeStoreWithRoles("rc-chk-rank");
    expect(await dbRefusal(insert(custom(a.store, "Zero", 0)))).toMatch(/"role_definitions_rank_positive"/);
    expect(await dbRefusal(insert(custom(a.store, "Negative", -5)))).toMatch(/"role_definitions_rank_positive"/);
  });
});
