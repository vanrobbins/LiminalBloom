// The seed turns two-factor off for every role of the demo store (the accounts share a password).

import { eq } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";

import { db } from "@/db";
import { roleDefinitions } from "@/db/schema";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { turnOffDemoTwoFactor } from "./target";

afterAll(dropStores);

it("clears requires_two_factor on the store's roles", async () => {
  const store = await makeStore("seed-2fa");
  await db.update(roleDefinitions).set({ requiresTwoFactor: true }).where(eq(roleDefinitions.storeId, store));
  await turnOffDemoTwoFactor(store);
  const rows = await db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, store));
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((r) => !r.requiresTwoFactor)).toBe(true);
});
