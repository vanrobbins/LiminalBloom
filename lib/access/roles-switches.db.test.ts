// Saving staged permissions and resetting a built-in, against the dev database: the rank rule, grant in
// both directions, the Store Manager's locks, version pins, all-or-nothing batches, and that the batch's
// FINAL state must nest (DECISIONS 11-11). Each refusal writes nothing.

import { afterAll, describe, expect, it } from "vitest";

import { dropStores } from "@/lib/products/test-stores";

import { resetRole, saveSwitches } from "./roles-switches";
import { actorIn, addCustom, byBuiltin, eventsOf, highRankIn, rolesOf, withOnly } from "./roles-test";
import { dropPeople, makeStoreWithRoles } from "./test-roles";
import type { Switch } from "./switches";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

/** Someone above every role who holds `held`: only what they hold can be changed. */
const editor = async (s: Awaited<ReturnType<typeof makeStoreWithRoles>>, ...held: Switch[]) => withOnly(await highRankIn(s), "roles.manage", ...held);
const edit = (r: { id: string; version: number }, switches: Switch[]) => ({ roleId: r.id, version: r.version, switches });

describe("saveSwitches", () => {
  it("saves a batch of two roles as one write: new switches, versions up, one event each saying what was added and removed", async () => {
    const s = await makeStoreWithRoles("rs-batch");
    const actor = await editor(s, "planograms.draft", "layout.edit");
    const vmw = await byBuiltin(s.store, "vm_worker");
    const vmm = await byBuiltin(s.store, "vm_manager");
    const out = await saveSwitches(s.store, actor, [
      edit(vmw, ["view", "products.stock", "products.sale"]),
      edit(vmm, ["view", "products.stock", "products.sale", "planograms.draft", "planograms.publish", "products.edit", "people.manage"]),
    ]);
    expect(out).toEqual({ status: "saved", roles: 2 });
    const [w, m] = [await byBuiltin(s.store, "vm_worker"), await byBuiltin(s.store, "vm_manager")];
    expect(w.switches).toEqual(["view", "products.stock", "products.sale"]);
    expect([w.version, m.version]).toEqual([vmw.version + 1, vmm.version + 1]);
    const events = await eventsOf(s.store);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.event === "role_switches_changed" && e.actorId === actor.userId)).toBe(true);
    expect(events.find((e) => e.detail.role === "Visual Merchandising Worker")?.detail).toMatchObject({ added: [], removed: ["planograms.draft"] });
    expect(events.find((e) => e.detail.role === "Visual Merchandising Manager")?.detail).toMatchObject({ added: [], removed: ["layout.edit"] });
  });

  it("accepts a whole column turned off at once, though no single cell from the top could go first", async () => {
    const s = await makeStoreWithRoles("rs-column");
    const actor = await editor(s, "products.stock");
    const roles = (await rolesOf(s.store)).filter((r) => r.builtin !== "store_manager");
    expect((await saveSwitches(s.store, actor, roles.map((r) => edit(r, (r.switches as Switch[]).filter((x) => x !== "products.stock"))))).status).toBe("saved");
    expect((await rolesOf(s.store)).map((r) => r.switches.includes("products.stock"))).toEqual([true, false, false, false, false]);
    // One role alone, from the top of the column, would have been refused: see the nesting test.
  });

  it("refuses by rank: the actor's own role, a role above, and someone without roles.manage; nothing is written", async () => {
    const s = await makeStoreWithRoles("rs-rank");
    const am = await actorIn(s, "assistant_manager");
    const sm = await byBuiltin(s.store, "store_manager");
    const own = await byBuiltin(s.store, "assistant_manager");
    const vmm = await actorIn(s, "vm_manager");
    const sa = await byBuiltin(s.store, "sales_associate");
    expect(await saveSwitches(s.store, am, [edit(sm, ["view"])])).toEqual({ status: "forbidden" });
    expect(await saveSwitches(s.store, am, [edit(own, ["view"])])).toEqual({ status: "forbidden" });
    expect(await saveSwitches(s.store, vmm, [edit(sa, ["view"])])).toEqual({ status: "forbidden" });
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses to turn a permission ON that the actor's own role lacks, and likewise OFF", async () => {
    const s = await makeStoreWithRoles("rs-grant");
    const actor = await editor(s, "products.stock");
    const sa = await byBuiltin(s.store, "sales_associate");
    const vmw = await byBuiltin(s.store, "vm_worker");
    expect(await saveSwitches(s.store, actor, [edit(sa, ["view", "products.stock", "products.sale"])])).toEqual({ status: "grant" });
    // Off: the actor lacks planograms.draft, so can't take it from the Worker even though that would nest.
    expect(await saveSwitches(s.store, actor, [edit(vmw, ["view", "products.stock", "products.sale"])])).toEqual({ status: "grant" });
    expect((await byBuiltin(s.store, "vm_worker")).switches).toContain("planograms.draft");
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses a role changed since the dialog opened, a missing role and an empty batch; the rest of a batch is not written", async () => {
    const s = await makeStoreWithRoles("rs-stale");
    const actor = await editor(s, "products.sale", "planograms.draft");
    const vmw = await byBuiltin(s.store, "vm_worker");
    const sa = await byBuiltin(s.store, "sales_associate");
    expect(await saveSwitches(s.store, actor, [edit(vmw, ["view", "products.stock"]), { ...edit(sa, ["view"]), version: sa.version + 5 }])).toEqual({ status: "stale" });
    expect((await byBuiltin(s.store, "vm_worker")).switches).toContain("products.sale");
    expect(await saveSwitches(s.store, actor, [edit({ id: "nope", version: 1 }, ["view"])])).toEqual({ status: "gone" });
    expect(await saveSwitches(s.store, actor, [])).toEqual({ status: "invalid" });
    expect(await saveSwitches(s.store, actor, [edit(sa, sa.switches as Switch[])])).toEqual({ status: "invalid" });
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses to edit the Store Manager's three out (a role above could try), and puts view back silently", async () => {
    const s = await makeStoreWithRoles("rs-locked");
    const actor = await editor(s, "products.sale", "people.manage", "store.settings");
    const sm = await byBuiltin(s.store, "store_manager");
    expect(await saveSwitches(s.store, actor, [edit(sm, ["view", "products.sale"])])).toEqual({ status: "locked" });
    const sa = await byBuiltin(s.store, "sales_associate");
    expect(await saveSwitches(s.store, actor, [edit(sa, ["products.stock"])])).toEqual({ status: "invalid" });
  });

  it("refuses a batch whose final state would not nest, naming the blocking role, in both directions", async () => {
    const s = await makeStoreWithRoles("rs-nest");
    const actor = await editor(s, "products.sale", "layout.edit", "products.stock");
    const vmw = await byBuiltin(s.store, "vm_worker");
    const sa = await byBuiltin(s.store, "sales_associate");
    const am = await byBuiltin(s.store, "assistant_manager");
    // Off for a higher role while a lower one still holds it: refused, naming the lowest holder.
    const off = await saveSwitches(s.store, actor, [edit(am, (am.switches as Switch[]).filter((x) => x !== "products.stock"))]);
    expect(off).toMatchObject({ status: "nesting", problem: { direction: "off", role: { name: "Assistant Manager" }, other: { name: "Sales Associate" }, switch: "products.stock" } });
    // On for a lower role while the one above lacks it.
    const on = await saveSwitches(s.store, actor, [edit(sa, ["view", "products.stock", "layout.edit"])]);
    expect(on).toMatchObject({ status: "nesting", problem: { direction: "on", role: { name: "Sales Associate" }, other: { name: "Visual Merchandising Worker" }, switch: "layout.edit" } });
    // Turning layout.edit on for the Worker needs the roles above to hold it (they do): allowed.
    expect((await saveSwitches(s.store, actor, [edit(vmw, [...(vmw.switches as Switch[]), "layout.edit"])])).status).toBe("saved");
    expect(await eventsOf(s.store)).toHaveLength(1);
  });

  it("does not blame the batch for a mismatch between two roles it did not touch", async () => {
    const s = await makeStoreWithRoles("rs-preexisting");
    // A custom role under the Sales Associate holding what the Sales Associate lacks: wrong already.
    await addCustom(s.store, "Odd", 600, ["view", "products.sale"]);
    const actor = await editor(s, "products.stock", "planograms.draft");
    const vmw = await byBuiltin(s.store, "vm_worker");
    expect((await saveSwitches(s.store, actor, [edit(vmw, ["view", "products.stock", "products.sale"])])).status).toBe("saved");
  });
});

describe("resetRole", () => {
  it("puts a built-in's name and permissions back, keeps its rank, logs role_reset", async () => {
    const s = await makeStoreWithRoles("rr-ok");
    const actor = await editor(s, "products.sale", "planograms.draft");
    const vmw = await byBuiltin(s.store, "vm_worker");
    expect((await saveSwitches(s.store, actor, [edit(vmw, ["view", "products.stock"])])).status).toBe("saved");
    const edited = await byBuiltin(s.store, "vm_worker");
    expect(await resetRole(s.store, actor, vmw.id, edited.version)).toEqual({ status: "reset", name: "Visual Merchandising Worker" });
    const after = await byBuiltin(s.store, "vm_worker");
    expect(after.switches).toEqual(["view", "products.stock", "products.sale", "planograms.draft"]);
    expect(after.rank).toBe(vmw.rank);
    expect((await eventsOf(s.store)).map((e) => e.event).sort()).toEqual(["role_reset", "role_switches_changed"]);
  });

  it("refuses a role already at its default, a stale version, a missing role, and a role the actor can't act on", async () => {
    const s = await makeStoreWithRoles("rr-refuse");
    const actor = await editor(s, "products.stock");
    const vmw = await byBuiltin(s.store, "vm_worker");
    expect(await resetRole(s.store, actor, vmw.id, vmw.version)).toEqual({ status: "invalid" });
    expect(await resetRole(s.store, actor, vmw.id, vmw.version + 1)).toEqual({ status: "stale" });
    expect(await resetRole(s.store, actor, "nope", 1)).toEqual({ status: "gone" });
    const custom = await addCustom(s.store, "Educator", 550, ["view"]);
    expect(await resetRole(s.store, actor, custom.id, custom.version)).toEqual({ status: "invalid" });
    const sm = await byBuiltin(s.store, "store_manager");
    expect(await resetRole(s.store, await actorIn(s, "assistant_manager"), sm.id, sm.version)).toEqual({ status: "forbidden" });
  });

  it("refuses a reset that would change a permission the actor lacks, and one whose default would not nest, naming the role", async () => {
    const s = await makeStoreWithRoles("rr-grant-nest");
    const sa = await byBuiltin(s.store, "sales_associate");
    const full = await editor(s, "products.sale", "planograms.draft", "products.stock");
    // The Worker loses sale (allowed: Sales Associate lacks it) and drops to stock only.
    const vmw = await byBuiltin(s.store, "vm_worker");
    await saveSwitches(s.store, full, [edit(vmw, ["view", "products.stock"])]);
    const edited = await byBuiltin(s.store, "vm_worker");
    // The actor lacks planograms.draft and products.sale, which a reset would turn on.
    expect(await resetRole(s.store, await editor(s, "products.stock"), edited.id, edited.version)).toEqual({ status: "grant" });
    // Now the role below the Worker's slot is edited to lack stock... the default (which has stock) would not nest under it.
    await saveSwitches(s.store, full, [edit(sa, ["view"])]);
    const worker = await byBuiltin(s.store, "vm_worker");
    const lacking = await saveSwitches(s.store, full, [edit(worker, ["view"])]);
    expect(lacking.status).toBe("saved");
    const vmm = await byBuiltin(s.store, "vm_manager");
    await saveSwitches(s.store, full, [edit(vmm, ["view", "planograms.draft", "planograms.publish", "layout.edit", "products.edit", "people.manage"])]);
    const w2 = await byBuiltin(s.store, "vm_worker");
    // The default Worker holds stock, but the Manager above it now lacks it.
    expect(await resetRole(s.store, full, w2.id, w2.version)).toMatchObject({ status: "nesting", problem: { role: { name: "Visual Merchandising Worker" }, other: { name: "Visual Merchandising Manager" }, switch: "products.stock" } });
  });
});
