// Adding a store to a company (spec 0.7.1 6.4, B0 finding 1), against the dev database with Better Auth's real
// createOrganization and its creation hook: the creator's member row is gone, the store keeps its key, settings
// and five roles, and a failure removes the store entirely.

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, organization } from "@/db/auth-schema";
import { companyEvents, roleDefinitions, storeKeys, storeProfiles, storeSettings } from "@/db/schema";
import { dropPeople } from "@/lib/access/test-roles";
import { auth } from "@/lib/auth";
import { dropStores } from "@/lib/products/test-stores";

import { addCompanyStore, type AddStoreActor } from "./store-add";
import { dropCompanies, makeBareAccount, makeCompany, makeRegion } from "./test-companies";

const madeStores: string[] = [];

afterAll(async () => {
  if (madeStores.length) await db.delete(organization).where(inArray(organization.id, madeStores));
  await dropStores();
  await dropCompanies();
  await dropPeople();
});

/** What the action does, with a user id in place of the request's headers. */
const createFor = (userId: string) => async (name: string, slug: string) => {
  const store = await auth.api.createOrganization({ body: { name, slug: `${slug}-${randomUUID().slice(0, 6)}`, userId, keepCurrentActiveOrganization: true } });
  if (store) madeStores.push(store.id);
  return store;
};

async function setup(label: string) {
  const owner = await makeBareAccount(label);
  const company = await makeCompany(label, owner);
  const actor: AddStoreActor = { userId: owner, name: "Ana Owner", companyId: company.id };
  return { owner, company, actor };
}

const rowsOf = async (storeId: string) => ({
  organization: (await db.select({ id: organization.id }).from(organization).where(eq(organization.id, storeId))).length,
  members: (await db.select({ id: member.id }).from(member).where(eq(member.organizationId, storeId))).length,
  roles: (await db.select({ id: roleDefinitions.id }).from(roleDefinitions).where(eq(roleDefinitions.storeId, storeId))).length,
  keys: (await db.select({ id: storeKeys.storeId }).from(storeKeys).where(eq(storeKeys.storeId, storeId))).length,
  settings: await db.select({ timezone: storeSettings.timezone, version: storeSettings.version }).from(storeSettings).where(eq(storeSettings.storeId, storeId)),
  profile: await db.select({ companyId: storeProfiles.companyId, regionId: storeProfiles.regionId }).from(storeProfiles).where(eq(storeProfiles.storeId, storeId)),
});

describe("addCompanyStore", { timeout: 60_000 }, () => {
  it("leaves the store in the company and region, with its key, five roles, the chosen zone, no member row and an event", async () => {
    const { owner, company, actor } = await setup("sa-ok");
    const region = await makeRegion(company.id, "North");
    const outcome = await addCompanyStore({ name: "Pioneer Place", timezone: "America/Chicago", regionId: region }, actor, createFor(owner));
    if (outcome.status !== "added") throw new Error(`not added: ${outcome.status}`);

    const rows = await rowsOf(outcome.storeId);
    expect(rows).toMatchObject({ organization: 1, members: 0, roles: 5, keys: 1, profile: [{ companyId: company.id, regionId: region }] });
    expect(rows.settings).toEqual([{ timezone: "America/Chicago", version: 2 }]);
    const events = await db.select({ event: companyEvents.event, detail: companyEvents.detail }).from(companyEvents).where(eq(companyEvents.companyId, company.id));
    expect(events).toEqual([{ event: "store_added", detail: { store: "Pioneer Place", region: "North" } }]);
  });

  it("removes the store completely when the batch fails: no organization, member, role, key or settings row", async () => {
    const { owner, actor } = await setup("sa-fail");
    // A company that does not exist fails the profile's key inside the batch, after the store was made.
    const outcome = await addCompanyStore({ name: "Doomed", timezone: "America/Chicago", regionId: null }, { ...actor, companyId: randomUUID() }, createFor(owner));
    expect(outcome).toEqual({ status: "failed" });
    const slugged = madeStores.at(-1);
    expect(slugged).toBeDefined();
    expect(await rowsOf(slugged!)).toEqual({ organization: 0, members: 0, roles: 0, keys: 0, settings: [], profile: [] });
  });

  it("refuses a bad name, zone or another company's region before any store is made", async () => {
    const { owner, actor } = await setup("sa-bad");
    const other = await makeCompany("sa-bad-other");
    const theirs = await makeRegion(other.id, "Theirs");
    const before = madeStores.length;
    const make = createFor(owner);
    expect(await addCompanyStore({ name: "A", timezone: "America/Chicago", regionId: null }, actor, make)).toEqual({ status: "invalid-name" });
    expect(await addCompanyStore({ name: "Fine", timezone: "Mars/Base", regionId: null }, actor, make)).toEqual({ status: "invalid-zone" });
    expect(await addCompanyStore({ name: "Fine", timezone: "America/Chicago", regionId: theirs }, actor, make)).toEqual({ status: "invalid-region" });
    expect(madeStores.length).toBe(before);
  });
});
