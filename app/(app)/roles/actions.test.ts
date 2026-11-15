// The real actions with the real current-member and resolveAccess against the dev database: only Better
// Auth's session is stood in for. Every refusal must come back from the action itself, because a person can
// call it with the controls hidden.

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, listOrganizations: mocks.listOrganizations } } }));

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { addCustom, byBuiltin, eventsOf, rolesOf } from "@/lib/access/roles-test";
import { dropPeople, makePerson, makeStoreWithRoles, type StoreRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";

import { createRoleAction, deleteRoleAction, moveRoleAction, renameRoleAction, resetRoleAction, saveSwitchesAction } from "./actions";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

describe("roles actions", () => {
  let store: string;
  let roles: StoreRoles;

  beforeEach(async () => {
    ({ store, roles } = await makeStoreWithRoles("roles-action"));
  });

  /** Signs in a new person holding the role with this id (a built-in's key maps through `roles`), or none, working in the store. */
  async function signInWith(roleId: string | null) {
    const { userId } = await makePerson(store, roleId);
    mocks.getSession.mockResolvedValue({ user: { id: userId, name: "Van", email: `${userId}@example.com` }, session: { activeOrganizationId: store } });
    mocks.listOrganizations.mockResolvedValue([{ id: store, name: "Test" }]);
    return userId;
  }
  const signInAs = (role: keyof StoreRoles | null) => signInWith(role ? roles[role] : null);
  const roleRow = (builtin: string) => byBuiltin(store, builtin);

  it("saves, renames, adds, moves, resets and deletes for an Assistant Manager, each with its event", async () => {
    await signInAs("assistant_manager");
    const sa = await roleRow("sales_associate");
    expect(await saveSwitchesAction([{ roleId: sa.id, version: sa.version, switches: ["view"] }])).toEqual({ status: "saved", roles: 1 });
    const vmw = await roleRow("vm_worker");
    expect((await renameRoleAction(vmw.id, vmw.version, "Floor")).status).toBe("renamed");
    expect(await createRoleAction("Educator", sa.id, ["view"])).toEqual({ status: "created", name: "Educator" });
    const educator = (await rolesOf(store)).find((r) => r.name === "Educator")!;
    expect((await moveRoleAction(educator.id, "up", sa.id)).status).toBe("moved");
    const renamed = await roleRow("vm_worker");
    expect((await resetRoleAction(renamed.id, renamed.version)).status).toBe("reset");
    expect(await deleteRoleAction(educator.id, educator.version, null, 0, 0)).toMatchObject({ status: "deleted", name: "Educator" });
    expect((await eventsOf(store)).map((e) => e.event).sort()).toEqual(["role_created", "role_deleted", "role_renamed", "role_reordered", "role_reset", "role_switches_changed"]);
  });

  it.each(["vm_manager", "vm_worker", "sales_associate", null] as const)("refuses a member whose role is %s, in all six, and changes nothing", async (role) => {
    const custom = await addCustom(store, "Educator", 550, ["view"]);
    const before = await rolesOf(store);
    await signInAs(role);
    const sa = await roleRow("sales_associate");
    expect(await saveSwitchesAction([{ roleId: sa.id, version: sa.version, switches: ["view"] }])).toEqual({ status: "forbidden" });
    expect(await renameRoleAction(sa.id, sa.version, "Educator 2")).toEqual({ status: "forbidden" });
    expect(await createRoleAction("New", sa.id, ["view"])).toEqual({ status: "forbidden" });
    expect(await moveRoleAction(custom.id, "up", sa.id)).toEqual({ status: "forbidden" });
    expect(await resetRoleAction(sa.id, sa.version)).toEqual({ status: "forbidden" });
    expect(await deleteRoleAction(custom.id, custom.version, null, 0, 0)).toEqual({ status: "forbidden" });
    expect(await rolesOf(store)).toEqual(before);
    expect(await eventsOf(store)).toEqual([]);
  });

  it("holds the rank rule: nobody changes their own role, the Store Manager's, or one above them", async () => {
    await signInAs("assistant_manager");
    const sm = await roleRow("store_manager");
    const own = await roleRow("assistant_manager");
    for (const role of [sm, own]) {
      expect(await saveSwitchesAction([{ roleId: role.id, version: role.version, switches: ["view"] }])).toEqual({ status: "forbidden" });
      expect(await renameRoleAction(role.id, role.version, "Boss")).toEqual({ status: "forbidden" });
      expect(await resetRoleAction(role.id, role.version)).toEqual({ status: "forbidden" });
    }
    expect(await createRoleAction("Above", sm.id, ["view"])).toEqual({ status: "rank" });
    await signInAs("store_manager");
    expect(await renameRoleAction(sm.id, sm.version, "Boss")).toEqual({ status: "forbidden" });
    expect(await eventsOf(store)).toEqual([]);
  });

  it("holds grant in both directions for a custom role that has roles.manage but not products.edit", async () => {
    const editor = await addCustom(store, "Role editor", 250, ["view", "roles.manage", "products.stock", "products.sale", "planograms.draft"]);
    await signInWith(editor.id);
    const vmw = await roleRow("vm_worker");
    const vmm = await roleRow("vm_manager");
    // On: the Worker gaining products.edit needs a permission the editor lacks.
    expect(await saveSwitchesAction([{ roleId: vmw.id, version: vmw.version, switches: [...vmw.switches, "products.edit"] }])).toEqual({ status: "grant" });
    // Off: the Manager losing products.edit needs it too.
    expect(await saveSwitchesAction([{ roleId: vmm.id, version: vmm.version, switches: vmm.switches.filter((s) => s !== "products.edit") }])).toEqual({ status: "grant" });
    // A permission the editor holds is fine.
    expect((await saveSwitchesAction([{ roleId: vmw.id, version: vmw.version, switches: vmw.switches.filter((s) => s !== "planograms.draft") }])).status).toBe("saved");
  });

  it("holds nesting: a permission can't go on for a role while a higher one lacks it, or off while a lower one has it", async () => {
    await signInAs("store_manager");
    const am = await roleRow("assistant_manager");
    const vmw = await roleRow("vm_worker");
    expect(await saveSwitchesAction([{ roleId: am.id, version: am.version, switches: am.switches.filter((s) => s !== "products.stock") }])).toMatchObject({ status: "nesting", problem: { direction: "off", role: { name: "Assistant Manager" } } });
    expect(await saveSwitchesAction([{ roleId: vmw.id, version: vmw.version, switches: [...vmw.switches, "store.settings"] }])).toMatchObject({ status: "nesting", problem: { direction: "on", switch: "store.settings", other: { name: "Visual Merchandising Manager" } } });
  });

  it("answers invalid, not an error, to arguments that are not what the action takes", async () => {
    await signInAs("assistant_manager");
    const sa = await roleRow("sales_associate");
    for (const bad of [undefined, null, 42, "", {}, "x".repeat(300)]) {
      expect(await renameRoleAction(bad, 1, "Name")).toEqual({ status: "invalid" });
      expect(await resetRoleAction(bad, 1)).toEqual({ status: "invalid" });
      expect(await moveRoleAction(bad, "up", "x")).toEqual({ status: "invalid" });
      expect(await createRoleAction("Name", bad, ["view"])).toEqual({ status: "invalid" });
      expect(await deleteRoleAction(bad, 1, null, 0, 0)).toEqual({ status: "invalid" });
    }
    expect(await saveSwitchesAction("not a list")).toEqual({ status: "invalid" });
    expect(await saveSwitchesAction([])).toEqual({ status: "invalid" });
    expect(await saveSwitchesAction([{ roleId: sa.id, version: 1, switches: ["view", "root.access"] }])).toEqual({ status: "invalid" });
    expect(await saveSwitchesAction([{ roleId: sa.id, version: 0, switches: ["view"] }])).toEqual({ status: "invalid" });
    expect(await moveRoleAction(sa.id, "sideways", "x")).toEqual({ status: "invalid" });
    expect(await renameRoleAction(sa.id, "1", "Name")).toEqual({ status: "invalid" });
    expect(await deleteRoleAction(sa.id, 1, null, -1, 0)).toEqual({ status: "invalid" });
    expect(await eventsOf(store)).toEqual([]);
  });

  it("deletes a role with people only together with moving them, and needs people.manage to do it", async () => {
    const custom = await addCustom(store, "Educator", 450, ["view", "products.stock", "products.sale", "planograms.draft"]);
    const holder = await makePerson(store, custom.id);
    const only = await addCustom(store, "Role only", 250, ["view", "roles.manage"]);
    await signInWith(only.id);
    expect(await deleteRoleAction(custom.id, custom.version, roles.sales_associate, 1, 0)).toEqual({ status: "cant-move-people" });
    await signInAs("assistant_manager");
    expect(await deleteRoleAction(custom.id, custom.version, null, 1, 0)).toEqual({ status: "invalid" });
    expect(await deleteRoleAction(custom.id, custom.version, roles.assistant_manager, 1, 0)).toEqual({ status: "rank" });
    expect(await deleteRoleAction(custom.id, custom.version, roles.sales_associate, 0, 0)).toMatchObject({ status: "people-changed" });
    expect((await deleteRoleAction(custom.id, custom.version, roles.sales_associate, 1, 0)).status).toBe("deleted");
    expect((await db.select({ r: member.roleId }).from(member).where(eq(member.id, holder.memberId)))[0].r).toBe(roles.sales_associate);
    expect(await db.select().from(roleDefinitions).where(eq(roleDefinitions.id, custom.id))).toEqual([]);
  });
});
