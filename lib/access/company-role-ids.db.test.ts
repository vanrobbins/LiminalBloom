// No write that takes a role id accepts a company role's id (`company:owner`, ... spec 0.7.1, 4.2). Those ids
// are the synthetic role a company person shows in a store, never a row. The lookup would refuse them anyway,
// so each test first plants a real role row that carries such an id: only the explicit refusal stops it.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { createInvitation } from "./invite";
import { changeRole } from "./people-write";
import { actorIn, personIn, type Setup } from "./people-test";
import { createRole, moveRole, renameRole } from "./roles-structure";
import { deleteRole } from "./roles-delete";
import { resetRole, saveSwitches } from "./roles-switches";
import { dropPeople, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

// One id per test: role ids are unique across every store, and the tests run side by side.
/** A store with a custom role whose id is a company role's, below everyone, and a Store Manager actor. */
async function planted(label: string, id: string): Promise<Setup & { actor: Awaited<ReturnType<typeof actorIn>> }> {
  const s = await makeStoreWithRoles(label);
  await db.insert(roleDefinitions).values({ id, storeId: s.store, name: "Planted", rank: 900, switches: ["view"] });
  const actor = await actorIn(s, "store_manager");
  return { ...s, actor: { ...actor, rank: 100 } };
}

const roleRows = async (store: string) => (await db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, store))).length;

describe("a company role id is not a role id", () => {
  it("invite create refuses it and writes no invitation", async () => {
    const FAKE = "company:owner";
    const s = await planted("ids-invite", FAKE);
    expect(await createInvitation(s.store, s.actor, "someone@example.test", FAKE)).toEqual({ status: "invalid" });
    expect(await db.select().from(invitation).where(eq(invitation.organizationId, s.store))).toHaveLength(0);
  });

  it("change role refuses it and leaves the person's role", async () => {
    const FAKE = "company:corporate_admin";
    const s = await planted("ids-change", FAKE);
    const jane = await personIn(s, "sales_associate");
    expect(await changeRole(s.store, s.actor, jane.memberId, jane.roleId, FAKE)).toEqual({ status: "invalid" });
    expect((await db.select({ r: member.roleId }).from(member).where(eq(member.id, jane.memberId)))[0].r).toBe(jane.roleId);
  });

  it("the roles editor refuses it for create, rename, move, reset, delete and a save of permissions, and changes nothing", async () => {
    const FAKE = "company:regional_manager";
    const s = await planted("ids-editor", FAKE);
    const before = await roleRows(s.store);
    const custom = (await db.select().from(roleDefinitions).where(eq(roleDefinitions.id, FAKE)))[0];
    expect(await createRole(s.store, s.actor, { name: "Another", belowId: FAKE, switches: ["view"] })).toEqual({ status: "invalid" });
    expect(await renameRole(s.store, s.actor, FAKE, custom.version, "Renamed")).toEqual({ status: "invalid" });
    expect(await moveRole(s.store, s.actor, FAKE, "up", s.roles.sales_associate)).toEqual({ status: "invalid" });
    expect(await moveRole(s.store, s.actor, s.roles.sales_associate, "down", FAKE)).toEqual({ status: "invalid" });
    expect(await resetRole(s.store, s.actor, FAKE, custom.version)).toEqual({ status: "invalid" });
    expect(await saveSwitches(s.store, s.actor, [{ roleId: FAKE, version: custom.version, switches: ["view", "products.edit"] }])).toEqual({ status: "invalid" });
    expect(await deleteRole(s.store, s.actor, { roleId: FAKE, version: custom.version, moveToId: null, members: 0, invitations: 0 })).toEqual({ status: "invalid" });
    const [mine] = await db.select().from(roleDefinitions).where(eq(roleDefinitions.id, s.roles.vm_worker));
    expect(await deleteRole(s.store, s.actor, { roleId: mine.id, version: mine.version, moveToId: FAKE, members: 0, invitations: 0 })).toEqual({ status: "invalid" });

    expect(await roleRows(s.store)).toBe(before);
    expect((await db.select().from(roleDefinitions).where(eq(roleDefinitions.id, FAKE)))[0]).toMatchObject({ name: "Planted", rank: 900, version: custom.version });
  });
});
