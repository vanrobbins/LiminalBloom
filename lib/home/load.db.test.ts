// What Home loads for each kind of viewer, from the dev database: only the cards their switches
// allow, nothing read for the rest, and no email in a viewer's data unless they manage people.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { accessEvents, planogramAdjustments, planogramVersions, planograms, products } from "@/db/schema";
import { BUILTIN_ROLES, type BuiltinRoleKey } from "@/lib/access/roles";
import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles, type StoreRoles } from "@/lib/access/test-roles";
import type { Switch } from "@/lib/access/switches";
import type { Member } from "@/lib/current-member";
import { addFixture, addProduct } from "@/lib/planograms/test-planograms";
import { dropStores, seedStoreFixtures } from "@/lib/products/test-stores";
import { storeToday } from "@/lib/time/format";
import { DEFAULT_TIMEZONE } from "@/lib/time/zones";

import { planogramSummaries } from "@/lib/planograms/queries";

import { loadHome } from "./load";

vi.mock("@/lib/planograms/queries", async (original) => {
  const real = await original<typeof import("@/lib/planograms/queries")>();
  return { ...real, planogramSummaries: vi.fn(real.planogramSummaries) };
});

beforeEach(() => {
  vi.mocked(planogramSummaries).mockClear();
});

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const NOW = new Date("2026-11-16T15:00:00Z");

function viewer(store: string, roles: StoreRoles, key: BuiltinRoleKey, switches?: Switch[]): Member {
  const def = BUILTIN_ROLES.find((r) => r.key === key)!;
  return { kind: "member", user: { id: "u", name: "Vi Ewer", email: "viewer@example.com" }, stores: [], activeStoreId: store, role: { id: roles[key], name: def.name, rank: def.rank }, switches: switches ?? [...def.switches], company: null, isPlatformAdmin: false, helpReplies: 0 };
}

/** A store with its manager, one fixture with a published planogram, an invitation and an access event naming an email. */
async function busyStore(label: string) {
  const { store, roles } = await makeStoreWithRoles(label);
  const manager = await makePerson(store, roles.store_manager);
  const { fixtureId } = await addFixture(store, { name: "Front table" });
  const planogramId = randomUUID();
  await db.insert(planograms).values({ id: planogramId, storeId: store, fixtureId, publishedVersion: 1, dueDate: "2026-11-13" });
  await db.insert(planogramVersions).values({ storeId: store, planogramId, number: 1, publishedAt: new Date("2026-11-10T10:00:00Z"), publishedByName: "Pat Publisher", placements: [] });
  await makeInvitation(store, manager.userId, roles.sales_associate);
  await db.insert(accessEvents).values({ storeId: store, actorName: "Van", event: "invitation_created", detail: { email: "secret.person@example.com", role: "Sales Associate" } });
  return { store, roles, manager, fixtureId };
}

describe("loadHome", () => {
  it("sends a viewer without people.manage no invitations, no changes and no email anywhere", async () => {
    const { store, roles } = await busyStore("home-priv");
    const data = await loadHome(viewer(store, roles, "vm_worker"), NOW);
    expect(data.invitations).toBeUndefined();
    expect(data.changes).toBeUndefined();
    expect(data.setup).toBeUndefined();
    expect(data.published?.map((p) => p.publisherName)).toEqual(["Pat Publisher"]);
    expect(JSON.stringify(data)).not.toContain("@");
  });

  it("gives a Sales Associate the recent publishes and nothing else", async () => {
    const { store, roles } = await busyStore("home-sa");
    const data = await loadHome(viewer(store, roles, "sales_associate"), NOW);
    expect(Object.keys(data)).toEqual(["published"]);
    expect(JSON.stringify(data)).not.toContain("@");
  });

  it("gives a Store Manager every card's data, the pending invitation with its email, and overdue judged on the store's today", async () => {
    const { store, roles, fixtureId } = await busyStore("home-mgr");
    await addProduct(store, (await seedStoreFixtures(store)).categoryId, "Loose Tee");
    const data = await loadHome(viewer(store, roles, "store_manager"), NOW);
    expect(storeToday(DEFAULT_TIMEZONE, NOW)).toBe("2026-11-16");
    expect(data.planograms?.rows.map((r) => [r.fixtureId, r.overdue])).toEqual([[fixtureId, true]]);
    expect(data.invitations).toHaveLength(1);
    expect(data.invitations?.[0]).toMatchObject({ roleName: "Sales Associate", state: "pending" });
    expect(data.invitations?.[0].email).toContain("@");
    expect(data.changes?.[0].text).toContain("secret.person@example.com");
    expect(data.notPlaced).toEqual({ products: 1, fixtures: 1 });
    expect(data.published).toHaveLength(1);
    expect(data.setup?.map((r) => r.key)).toEqual(["layout"]);
  });

  it("reads no planogram data for a viewer with layout.edit alone, who still gets the layout step", async () => {
    const { store, roles } = await busyStore("home-layout");
    const data = await loadHome(viewer(store, roles, "sales_associate", ["view", "layout.edit"]), NOW);
    expect(data.setup?.map((r) => r.key)).toEqual(["layout"]);
    expect(data.planograms).toBeUndefined();
    expect(data.notPlaced).toBeUndefined();
    expect(planogramSummaries).not.toHaveBeenCalled();
  });

  it("sends a people.manage viewer id null for an invitation to a role at or above their own, as People does", async () => {
    const { store, roles } = await makeStoreWithRoles("home-rank");
    const manager = await makePerson(store, roles.store_manager);
    await makeInvitation(store, manager.userId, roles.assistant_manager);
    await makeInvitation(store, manager.userId, roles.vm_manager);
    await makeInvitation(store, manager.userId, roles.sales_associate);
    const data = await loadHome(viewer(store, roles, "vm_manager"), NOW);
    const idByRole = Object.fromEntries((data.invitations ?? []).map((i) => [i.roleName, i.id]));
    expect(idByRole["Assistant Manager"]).toBeNull();
    expect(idByRole["Visual Merchandising Manager"]).toBeNull();
    expect(idByRole["Sales Associate"]).toEqual(expect.any(String));
  });

  it("gives a roles.manage viewer without people.manage the changes with no email, and no invitations", async () => {
    const { store, roles } = await busyStore("home-roles");
    const data = await loadHome(viewer(store, roles, "vm_worker", ["view", "roles.manage"]), NOW);
    expect(data.invitations).toBeUndefined();
    expect(data.changes?.length).toBeGreaterThan(0);
    expect(JSON.stringify(data)).not.toContain("@");
  });

  it("offers Invite your team to a lone manager, and counts only a still-pending invitation as an invitation", async () => {
    const { store, roles } = await makeStoreWithRoles("home-team");
    const manager = await makePerson(store, roles.store_manager);
    const lone = viewer(store, roles, "store_manager");
    expect((await loadHome(lone, NOW)).setup?.map((r) => r.key)).toContain("team");
    await makeInvitation(store, manager.userId, roles.sales_associate);
    const open = await loadHome(lone, NOW);
    expect(open.setup?.map((r) => r.key)).not.toContain("team");
    const later = await loadHome(lone, new Date(NOW.getTime() + 30 * 86_400_000));
    expect(later.invitations?.[0].state).toBe("expired");
    expect(later.setup?.map((r) => r.key)).toContain("team");
  });

  it("sends Sold out on display (with its count) to a drafter only, and a Quick Adjust draft in the planogram rows", async () => {
    const { store, roles, fixtureId } = await busyStore("home-sold");
    const fx = await seedStoreFixtures(store);
    await db.update(products).set({ status: "sold_out" }).where(eq(products.id, fx.productId));
    const [plan] = await db.select({ id: planograms.id }).from(planograms).where(eq(planograms.fixtureId, fixtureId));
    await db.insert(planogramAdjustments).values({ storeId: store, planogramId: plan.id, state: "draft", basedOnVersion: 1, createdByName: "Pat" });
    const worker = await loadHome(viewer(store, roles, "vm_worker"), NOW);
    expect(worker.soldOut).toEqual({ products: 1 });
    expect(worker.planograms?.rows.map((r) => [r.fixtureId, r.adjustment])).toEqual([[fixtureId, "draft"]]);
    expect((await loadHome(viewer(store, roles, "sales_associate"), NOW)).soldOut).toBeUndefined();
    expect((await loadHome(viewer(store, roles, "sales_associate", ["view", "planograms.publish"]), NOW)).soldOut).toBeUndefined();
  });
});
