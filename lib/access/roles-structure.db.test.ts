// Adding, renaming and moving roles against the dev database: placement and renumbering, the rank rule,
// grant, name rules (case-insensitive duplicates), pins, and that nothing is written on a refusal.

import { afterAll, describe, expect, it } from "vitest";

import { dropStores } from "@/lib/products/test-stores";

import { createRole, moveRole, renameRole } from "./roles-structure";
import { actorIn, addCustom, byBuiltin, eventsOf, highRankIn, roleNamed, rolesOf, withOnly } from "./roles-test";
import { dropPeople, makeStoreWithRoles } from "./test-roles";
import type { Switch } from "./switches";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

type Setup = Awaited<ReturnType<typeof makeStoreWithRoles>>;
const editor = async (s: Setup, ...held: Switch[]) => withOnly(await highRankIn(s), "roles.manage", ...held);
const WORKER: Switch[] = ["view", "products.stock", "products.sale", "planograms.draft"];
const names = async (store: string) => (await rolesOf(store)).map((r) => r.name);

describe("createRole", () => {
  it("places the role below the chosen one with a rank between, and logs role_created", async () => {
    const s = await makeStoreWithRoles("cr-place");
    const actor = await actorIn(s, "assistant_manager");
    const vmm = await byBuiltin(s.store, "vm_manager");
    const stamp = (await byBuiltin(s.store, "store_manager")).updatedAt.getTime();
    expect(await createRole(s.store, actor, { name: "  Educator ", belowId: vmm.id, switches: ["view", "products.stock", "products.sale", "planograms.draft"] })).toEqual({ status: "created", name: "Educator" });
    const made = await roleNamed(s.store, "Educator");
    expect(made).toMatchObject({ rank: 350, builtin: null, switches: ["view", "products.stock", "products.sale", "planograms.draft"], version: 1 });
    expect((await eventsOf(s.store)).map((e) => e.event)).toEqual(["role_created"]);
    // Adding a role touches the Store Manager row, so a write planned before it fails its pin.
    expect((await byBuiltin(s.store, "store_manager")).updatedAt.getTime()).toBeGreaterThan(stamp);
    expect((await names(s.store)).slice(2, 5)).toEqual(["Visual Merchandising Manager", "Educator", "Visual Merchandising Worker"]);
  });

  it("goes to the bottom when placed below the last role, and renumbers when the gap is full", async () => {
    const s = await makeStoreWithRoles("cr-renumber");
    const actor = await actorIn(s, "assistant_manager");
    const sa = await byBuiltin(s.store, "sales_associate");
    expect((await createRole(s.store, actor, { name: "Last", belowId: sa.id, switches: ["view"] })).status).toBe("created");
    expect((await roleNamed(s.store, "Last")).rank).toBe(600);
    await addCustom(s.store, "Wedge", 301, WORKER);
    const vmm = await byBuiltin(s.store, "vm_manager");
    expect((await createRole(s.store, actor, { name: "Squeezed", belowId: vmm.id, switches: WORKER })).status).toBe("created");
    const rows = await rolesOf(s.store);
    expect(rows.map((r) => r.name)).toEqual(["Store Manager", "Assistant Manager", "Visual Merchandising Manager", "Squeezed", "Wedge", "Visual Merchandising Worker", "Sales Associate", "Last"]);
    expect(rows.map((r) => r.rank)).toEqual([100, 200, 300, 400, 500, 600, 700, 800]);
  });

  it("refuses a place above the actor's own role, a missing place, a permission the actor lacks, and a taken name in any case", async () => {
    const s = await makeStoreWithRoles("cr-refuse");
    const am = await actorIn(s, "assistant_manager");
    const sm = await byBuiltin(s.store, "store_manager");
    const sa = await byBuiltin(s.store, "sales_associate");
    const vmm = await byBuiltin(s.store, "vm_manager");
    expect(await createRole(s.store, am, { name: "Boss", belowId: sm.id, switches: ["view"] })).toEqual({ status: "rank" });
    expect(await createRole(s.store, am, { name: "Lost", belowId: "nope", switches: ["view"] })).toEqual({ status: "gone" });
    const vmmActor = withOnly(await highRankIn(s), "roles.manage", "products.stock");
    expect(await createRole(s.store, vmmActor, { name: "Greedy", belowId: sa.id, switches: ["view", "products.sale"] })).toEqual({ status: "grant" });
    expect(await createRole(s.store, am, { name: "sales associate", belowId: vmm.id, switches: ["view"] })).toEqual({ status: "taken" });
    expect(await createRole(s.store, am, { name: "   ", belowId: vmm.id, switches: ["view"] })).toEqual({ status: "empty-name" });
    expect(await createRole(s.store, am, { name: "x".repeat(41), belowId: vmm.id, switches: ["view"] })).toEqual({ status: "long-name" });
    expect(await eventsOf(s.store)).toEqual([]);
    expect(await rolesOf(s.store)).toHaveLength(5);
  });

  it("refuses a role that would not nest with its neighbours, either side, naming the blocking role", async () => {
    const s = await makeStoreWithRoles("cr-nest");
    const actor = await editor(s, "products.sale", "planograms.draft", "products.stock", "layout.edit");
    const vmw = await byBuiltin(s.store, "vm_worker");
    const sa = await byBuiltin(s.store, "sales_associate");
    // Below the Sales Associate it may hold nothing the Sales Associate lacks.
    expect(await createRole(s.store, actor, { name: "Under", belowId: sa.id, switches: ["view", "products.sale"] })).toMatchObject({ status: "nesting", problem: { direction: "on", role: { name: "Under" }, other: { name: "Sales Associate" }, switch: "products.sale" } });
    // Above the Sales Associate it must hold what the Sales Associate holds.
    const above = await createRole(s.store, actor, { name: "Over", belowId: vmw.id, switches: ["view"] });
    expect(above).toMatchObject({ status: "nesting", problem: { direction: "off", role: { name: "Over" }, other: { name: "Sales Associate" }, switch: "products.stock" } });
    expect(await createRole(s.store, actor, { name: "Between", belowId: vmw.id, switches: ["view", "products.stock"] })).toEqual({ status: "created", name: "Between" });
    expect(await rolesOf(s.store)).toHaveLength(6);
  });
});

describe("renameRole", () => {
  it("renames anywhere at once: version up, one event, the old and new name in it", async () => {
    const s = await makeStoreWithRoles("rn-ok");
    const actor = await actorIn(s, "assistant_manager");
    const sa = await byBuiltin(s.store, "sales_associate");
    expect(await renameRole(s.store, actor, sa.id, sa.version, " Educator ")).toEqual({ status: "renamed", from: "Sales Associate", to: "Educator" });
    expect(await roleNamed(s.store, "Educator")).toMatchObject({ id: sa.id, version: sa.version + 1, builtin: "sales_associate" });
    const [event] = await eventsOf(s.store);
    expect(event).toMatchObject({ event: "role_renamed", detail: { from: "Sales Associate", to: "Educator" } });
  });

  it("refuses by rank, a stale version, a missing role, a taken name (any case), a bad name and an unchanged one", async () => {
    const s = await makeStoreWithRoles("rn-refuse");
    const am = await actorIn(s, "assistant_manager");
    const sm = await byBuiltin(s.store, "store_manager");
    const own = await byBuiltin(s.store, "assistant_manager");
    const sa = await byBuiltin(s.store, "sales_associate");
    expect(await renameRole(s.store, am, sm.id, sm.version, "Boss")).toEqual({ status: "forbidden" });
    expect(await renameRole(s.store, am, own.id, own.version, "Me")).toEqual({ status: "forbidden" });
    expect(await renameRole(s.store, am, sa.id, sa.version + 1, "Educator")).toEqual({ status: "stale" });
    expect(await renameRole(s.store, am, "nope", 1, "Educator")).toEqual({ status: "gone" });
    expect(await renameRole(s.store, am, sa.id, sa.version, "visual merchandising worker")).toEqual({ status: "taken" });
    expect(await renameRole(s.store, am, sa.id, sa.version, "")).toEqual({ status: "empty-name" });
    expect(await renameRole(s.store, am, sa.id, sa.version, "y".repeat(41))).toEqual({ status: "long-name" });
    expect(await renameRole(s.store, am, sa.id, sa.version, "Sales Associate")).toEqual({ status: "invalid" });
    expect(await eventsOf(s.store)).toEqual([]);
  });
});

describe("moveRole", () => {
  it("swaps a custom role with its neighbour, down then up, and logs role_reordered", async () => {
    const s = await makeStoreWithRoles("mv-ok");
    const actor = await actorIn(s, "assistant_manager");
    const custom = await addCustom(s.store, "Educator", 350, ["view", "products.stock", "products.sale", "planograms.draft"]);
    const vmw = await byBuiltin(s.store, "vm_worker");
    expect(await moveRole(s.store, actor, custom.id, "down", vmw.id)).toEqual({ status: "moved", name: "Educator", past: "Visual Merchandising Worker", direction: "down" });
    expect((await names(s.store)).slice(3)).toEqual(["Visual Merchandising Worker", "Educator", "Sales Associate"]);
    const vmm = await byBuiltin(s.store, "vm_manager");
    expect((await moveRole(s.store, actor, custom.id, "up", vmw.id)).status).toBe("moved");
    expect((await names(s.store)).slice(2)).toEqual(["Visual Merchandising Manager", "Educator", "Visual Merchandising Worker", "Sales Associate"]);
    expect(vmm.rank).toBe(300);
    expect((await eventsOf(s.store)).map((e) => e.detail.direction).sort()).toEqual(["down", "up"]);
  });

  it("refuses a built-in, an edge, a neighbour that isn't the one seen, a move above the actor's own role, and a role not below the actor", async () => {
    const s = await makeStoreWithRoles("mv-refuse");
    const am = await actorIn(s, "assistant_manager");
    const first = await addCustom(s.store, "First", 250, ["view"]);
    const sa = await byBuiltin(s.store, "sales_associate");
    const vmw = await byBuiltin(s.store, "vm_worker");
    const own = await byBuiltin(s.store, "assistant_manager");
    expect(await moveRole(s.store, am, sa.id, "up", vmw.id)).toEqual({ status: "invalid" });
    expect(await moveRole(s.store, am, first.id, "up", own.id)).toEqual({ status: "rank" });
    expect(await moveRole(s.store, am, first.id, "down", sa.id)).toEqual({ status: "stale" });
    expect(await moveRole(s.store, am, "nope", "up", own.id)).toEqual({ status: "gone" });
    const vmmActor = await actorIn(s, "vm_manager");
    expect(await moveRole(s.store, vmmActor, first.id, "down", (await byBuiltin(s.store, "vm_manager")).id)).toEqual({ status: "forbidden" });
    expect(await eventsOf(s.store)).toEqual([]);
  });

  it("refuses a move that would leave the roles not nesting, naming the blocking role, and moves nothing", async () => {
    const s = await makeStoreWithRoles("mv-nest");
    const am = await actorIn(s, "assistant_manager");
    // Between the Worker and the Sales Associate, with nothing the Worker lacks and everything the Sales Associate has.
    const custom = await addCustom(s.store, "Planner", 450, ["view", "products.stock", "planograms.draft"]);
    const sa = await byBuiltin(s.store, "sales_associate");
    const vmw = await byBuiltin(s.store, "vm_worker");
    // Below the Sales Associate it would hold planograms.draft (and stock) the Sales Associate lacks (draft).
    expect(await moveRole(s.store, am, custom.id, "down", sa.id)).toMatchObject({ status: "nesting", problem: { direction: "on", role: { name: "Planner" }, other: { name: "Sales Associate" }, switch: "planograms.draft" } });
    expect((await names(s.store)).slice(3)).toEqual(["Visual Merchandising Worker", "Planner", "Sales Associate"]);
    // Up past the Worker: the Worker would then sit below it holding products.sale, which it lacks.
    expect(await moveRole(s.store, am, custom.id, "up", vmw.id)).toMatchObject({ status: "nesting", problem: { role: { name: "Visual Merchandising Worker" }, other: { name: "Planner" }, switch: "products.sale" } });
    expect(await eventsOf(s.store)).toEqual([]);
  });
});
