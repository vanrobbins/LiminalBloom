// What /company reads, against the dev database: counts per region, stores with their region, and a regional
// manager seeing only their own region.

import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { storeSuspensions } from "@/db/schema";
import { dropPeople } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { companyView } from "./queries";
import { recentChanges } from "./recent";
import { addRegion } from "./structure-write";
import { assignCompanyRole, dropCompanies, makeAccount, makeBareAccount, makeCompany, makeCompanyStore, makeRegion } from "./test-companies";

afterAll(async () => {
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

const access = (id: string, name: string, role: "owner" | "corporate_admin" | "regional_manager", regionId: string | null = null) => ({ id, name, role, regionId, regionName: null, switches: [] });

describe("companyView", { timeout: 30_000 }, () => {
  it("lists regions with store and manager counts and stores with their region and pause", async () => {
    const owner = await makeBareAccount("q-owner");
    const c = await makeCompany("q-all", owner);
    const north = await makeRegion(c.id, "North");
    const south = await makeRegion(c.id, "South");
    const a = await makeCompanyStore(c.id, north, "q-a");
    await makeCompanyStore(c.id, null, "q-b");
    await assignCompanyRole(c.id, await makeAccount("q-mgr"), "regional_manager", north);
    await db.insert(storeSuspensions).values({ storeId: a.store, reason: "test", suspendedByName: "Liminal Bloom" });

    const view = await companyView(access(c.id, "x", "owner"));
    expect(view.ownerName).toBe("Test q-owner");
    expect(view.regions).toEqual([
      { id: north, name: "North", stores: 1, managers: 1 },
      { id: south, name: "South", stores: 0, managers: 0 },
    ]);
    expect(view.stores).toEqual([
      expect.objectContaining({ regionId: north, regionName: "North", paused: true }),
      expect.objectContaining({ regionId: null, regionName: null, paused: false }),
    ]);
  });

  it("shows a regional manager only their own region and its stores", async () => {
    const c = await makeCompany("q-rm");
    const north = await makeRegion(c.id, "North");
    await makeRegion(c.id, "South");
    await makeCompanyStore(c.id, north, "q-rm-n");
    await makeCompanyStore(c.id, null, "q-rm-0");
    const view = await companyView(access(c.id, "x", "regional_manager", north));
    expect(view.regions.map((r) => r.name)).toEqual(["North"]);
    expect(view.stores).toHaveLength(1);
  });
});

describe("recentChanges", { timeout: 30_000 }, () => {
  it("reads the company's own events newest first", async () => {
    const c = await makeCompany("q-ev");
    await addRegion(c.id, { userId: c.ownerId, name: "Ana" }, "North");
    await addRegion(c.id, { userId: c.ownerId, name: "Ana" }, "South");
    const rows = await recentChanges(access(c.id, "Acme", "corporate_admin"));
    expect(rows.map((r) => r.text)).toEqual(["Ana added the region South", "Ana added the region North"]);
  });
});
