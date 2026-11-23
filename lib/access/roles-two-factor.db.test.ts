// "Requires two-factor" on a role, against the development database (spec 0.7.1 1, A3b): the default a store's
// roles and a new role start with, the rank rule, version pins, one event per change, nothing written on a
// refusal, and that resolveAccess carries it for the person's own role.

import { afterAll, describe, expect, it } from "vitest";

import { dropStores } from "@/lib/products/test-stores";

import { resolveAccess } from "./resolve";
import { createRole } from "./roles-structure";
import { setRequiresTwoFactor } from "./roles-two-factor";
import { actorIn, addCustom, byBuiltin, eventsOf, highRankIn, roleNamed, rolesOf, withOnly } from "./roles-test";
import { dropPeople, makePerson, makeStoreWithRoles } from "./test-roles";
import type { Switch } from "./switches";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

type Setup = Awaited<ReturnType<typeof makeStoreWithRoles>>;
const editor = async (s: Setup) => withOnly(await highRankIn(s), "roles.manage");
const flags = async (store: string) => Object.fromEntries((await rolesOf(store)).map((r) => [r.builtin ?? r.name, r.requiresTwoFactor]));

describe("the default", () => {
  it("is on for the built-in roles holding people.manage or roles.manage and off for the rest", async () => {
    const s = await makeStoreWithRoles("rtf-default");
    expect(await flags(s.store)).toEqual({ store_manager: true, assistant_manager: true, vm_manager: true, vm_worker: false, sales_associate: false });
  });

  it("is the same for a role added later: on with people.manage or roles.manage, off without", async () => {
    const s = await makeStoreWithRoles("rtf-created");
    const actor = await actorIn(s, "assistant_manager");
    const lead = await byBuiltin(s.store, "vm_manager");
    const floor = await byBuiltin(s.store, "vm_worker");
    expect((await createRole(s.store, actor, { name: "Lead", belowId: lead.id, switches: lead.switches as Switch[] })).status).toBe("created");
    expect((await createRole(s.store, actor, { name: "Floor", belowId: floor.id, switches: ["view", "products.stock"] })).status).toBe("created");
    expect((await roleNamed(s.store, "Lead")).requiresTwoFactor).toBe(true);
    expect((await roleNamed(s.store, "Floor")).requiresTwoFactor).toBe(false);
  });
});

describe("setRequiresTwoFactor", () => {
  it("turns it on and off for a role below the editor's, bumps the version and logs one event each time", async () => {
    const s = await makeStoreWithRoles("rtf-set");
    const actor = await editor(s);
    const worker = await byBuiltin(s.store, "vm_worker");
    expect(await setRequiresTwoFactor(s.store, actor, worker.id, worker.version, true)).toEqual({ status: "set", name: "Visual Merchandising Worker", on: true });
    const on = await byBuiltin(s.store, "vm_worker");
    expect(on).toMatchObject({ requiresTwoFactor: true, version: worker.version + 1 });
    expect(await setRequiresTwoFactor(s.store, actor, on.id, on.version, false)).toMatchObject({ status: "set", on: false });
    const events = await eventsOf(s.store);
    expect(events.map((e) => e.event)).toEqual(["role_two_factor_changed", "role_two_factor_changed"]);
    expect(events.map((e) => e.detail)).toEqual(expect.arrayContaining([{ role: "Visual Merchandising Worker", on: true }, { role: "Visual Merchandising Worker", on: false }]));
    expect(events.every((e) => e.actorId === actor.userId)).toBe(true);
  });

  it("refuses a role at or above the editor's rank, and a person without roles.manage, writing nothing", async () => {
    const s = await makeStoreWithRoles("rtf-rank");
    const manager = await byBuiltin(s.store, "store_manager");
    const assistant = await actorIn(s, "assistant_manager");
    const vmm = await byBuiltin(s.store, "vm_manager");
    // Own rank and above: the rank rule. The Assistant Manager holds roles.manage and sits at 200.
    expect(await setRequiresTwoFactor(s.store, assistant, manager.id, manager.version, false)).toEqual({ status: "forbidden" });
    const own = await byBuiltin(s.store, "assistant_manager");
    expect(await setRequiresTwoFactor(s.store, assistant, own.id, own.version, false)).toEqual({ status: "forbidden" });
    const noSwitch = withOnly(await highRankIn(s), "people.manage");
    expect(await setRequiresTwoFactor(s.store, noSwitch, vmm.id, vmm.version, false)).toEqual({ status: "forbidden" });
    expect(await flags(s.store)).toMatchObject({ store_manager: true, assistant_manager: true, vm_manager: true });
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses a version the person did not see, a role that is gone, and a value already set", async () => {
    const s = await makeStoreWithRoles("rtf-stale");
    const actor = await editor(s);
    const worker = await byBuiltin(s.store, "vm_worker");
    expect(await setRequiresTwoFactor(s.store, actor, worker.id, worker.version + 7, true)).toEqual({ status: "stale" });
    expect(await setRequiresTwoFactor(s.store, actor, "no-such-role", 1, true)).toEqual({ status: "gone" });
    expect(await setRequiresTwoFactor(s.store, actor, worker.id, worker.version, false)).toEqual({ status: "invalid" });
    expect((await byBuiltin(s.store, "vm_worker")).requiresTwoFactor).toBe(false);
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("never touches another store's role of the same id shape", async () => {
    const a = await makeStoreWithRoles("rtf-iso-a");
    const b = await makeStoreWithRoles("rtf-iso-b");
    const roleInB = await byBuiltin(b.store, "vm_worker");
    expect(await setRequiresTwoFactor(a.store, await editor(a), roleInB.id, roleInB.version, true)).toEqual({ status: "gone" });
    expect((await byBuiltin(b.store, "vm_worker")).requiresTwoFactor).toBe(false);
  });
});

describe("resolveAccess carries it", () => {
  it("says a person's role requires two-factor only when it does, and a person with no role does not", async () => {
    const s = await makeStoreWithRoles("rtf-resolve");
    const manager = await makePerson(s.store, s.roles.store_manager);
    const associate = await makePerson(s.store, s.roles.sales_associate);
    const nobody = await makePerson(s.store, null);
    expect((await resolveAccess(manager.userId, { activeStoreId: s.store })).requiresTwoFactor).toBe(true);
    expect((await resolveAccess(associate.userId, { activeStoreId: s.store })).requiresTwoFactor).toBe(false);
    expect((await resolveAccess(nobody.userId, { activeStoreId: s.store })).requiresTwoFactor).toBe(false);
    const custom = await addCustom(s.store, "Trainer", 450, ["view"]);
    const trainer = await makePerson(s.store, custom.id);
    expect((await resolveAccess(trainer.userId, { activeStoreId: s.store })).requiresTwoFactor).toBe(false);
    const actor = await editor(s);
    expect(await setRequiresTwoFactor(s.store, actor, custom.id, custom.version, true)).toMatchObject({ status: "set" });
    expect((await resolveAccess(trainer.userId, { activeStoreId: s.store })).requiresTwoFactor).toBe(true);
  });
});
