// What the Roles screen is sent, against the dev database: every role in rank order with what the viewer
// may change, who holds each custom role (names and waiting invitations), the latest events as sentences,
// and that an invitation's email reaches only someone who may manage people.

import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { accessEvents } from "@/db/schema";
import type { Member } from "@/lib/current-member";
import { dropStores } from "@/lib/products/test-stores";

import { BUILTIN_ROLES } from "./roles";
import { rolesViewFor } from "./roles-read";
import { addCustom } from "./roles-test";
import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles } from "./test-roles";
import type { Switch } from "./switches";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

function viewer(store: string, key: string, roleId: string, extra: Partial<Member> = {}): Member {
  const def = BUILTIN_ROLES.find((r) => r.key === key)!;
  return { kind: "member", user: { id: "u", name: "Van", email: "v@example.com" }, stores: [{ id: store, name: "Test" }], activeStoreId: store, role: { id: roleId, name: def.name, rank: def.rank }, switches: [...def.switches], ...extra };
}

describe("rolesViewFor", () => {
  it("lists every role in rank order, marking what an Assistant Manager may change, with the viewer's own permissions", async () => {
    const { store, roles } = await makeStoreWithRoles("rd-rows");
    const view = await rolesViewFor(viewer(store, "assistant_manager", roles.assistant_manager));
    expect(view.roles.map((r) => [r.name, r.editable])).toEqual([
      ["Store Manager", false],
      ["Assistant Manager", false],
      ["Visual Merchandising Manager", true],
      ["Visual Merchandising Worker", true],
      ["Sales Associate", true],
    ]);
    expect(view.roles[1].relation).toBe("you");
    expect(view.holds).not.toContain("store.settings");
    expect(view.canMovePeople).toBe(true);
    expect(view.placements.map((p) => p.name)).toEqual(["Assistant Manager", "Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]);
  });

  it("says who holds a custom role, by name A to Z, and how many invitations wait; built-ins carry no list", async () => {
    const { store, roles } = await makeStoreWithRoles("rd-people");
    const custom = await addCustom(store, "Educator", 450, ["view" as Switch]);
    const a = await makePerson(store, custom.id);
    await makePerson(store, custom.id);
    await makePerson(store, roles.sales_associate);
    await makeInvitation(store, a.userId, custom.id);
    const view = await rolesViewFor(viewer(store, "assistant_manager", roles.assistant_manager));
    const educator = view.roles.find((r) => r.name === "Educator")!;
    expect(educator.people.names).toEqual(["Test person", "Test person"]);
    expect(educator.people.invitations).toBe(1);
    expect(educator).toMatchObject({ builtin: null, upId: roles.vm_worker, downId: roles.sales_associate });
    expect(view.roles.find((r) => r.builtin === "sales_associate")!.people).toEqual({ names: [], invitations: 0 });
  });

  it("writes the latest events as sentences, newest first, hiding an invitation's email from someone who can't manage people", async () => {
    const { store, roles } = await makeStoreWithRoles("rd-activity");
    const { userId } = await makePerson(store, roles.store_manager);
    await db.insert(accessEvents).values([
      { storeId: store, actorId: userId, actorName: "Van Robbins", event: "role_renamed", detail: { from: "Sales Associate", to: "Educator" }, createdAt: new Date("2026-11-11T10:00:00Z") },
      { storeId: store, actorId: userId, actorName: "Van Robbins", event: "invitation_created", detail: { email: "jane@x.com", role: "Sales Associate" }, createdAt: new Date("2026-11-11T11:00:00Z") },
    ]);
    const manager = await rolesViewFor(viewer(store, "assistant_manager", roles.assistant_manager));
    expect(manager.activity.map((l) => l.text)).toEqual(["Van Robbins invited jane@x.com as Sales Associate", "Van Robbins renamed Sales Associate to Educator"]);
    const editorOnly = await rolesViewFor(viewer(store, "assistant_manager", roles.assistant_manager, { switches: ["view", "roles.manage"] }));
    expect(editorOnly.activity[0].text).toBe("Van Robbins created an invitation as Sales Associate");
    expect(editorOnly.canMovePeople).toBe(false);
  });

  it("sends only the latest 20 events, and nothing from another store", async () => {
    const { store, roles } = await makeStoreWithRoles("rd-limit");
    const other = await makeStoreWithRoles("rd-limit-other");
    const rows = Array.from({ length: 25 }, (_, i) => ({ storeId: store, actorName: "Van", event: "role_created", detail: { role: `R${i}` }, createdAt: new Date(Date.UTC(2026, 10, 11, 8, i)) }));
    await db.insert(accessEvents).values([...rows, { storeId: other.store, actorName: "Eve", event: "role_created", detail: { role: "Secret" } }]);
    const view = await rolesViewFor(viewer(store, "assistant_manager", roles.assistant_manager));
    expect(view.activity).toHaveLength(20);
    expect(view.activity[0].text).toBe("Van added the role R24");
    expect(view.activity.some((l) => l.text.includes("Secret"))).toBe(false);
  });
});
