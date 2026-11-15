// Role definitions and the access log under row-level security, and the
// composite foreign keys from member and invitation (migration 0018), against
// the dev database like lib/planograms/rls.test.ts. What is tested is Postgres
// refusing rows, so a mock would only test the mock.

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member, organization } from "@/db/auth-schema";
import { accessEvents, roleDefinitions } from "@/db/schema";
import { dbRefusal } from "@/lib/db/test-errors";
import { withStore } from "@/lib/db/with-store";
import { dropStores } from "@/lib/products/test-stores";

import { dropPeople, makeInvitation, makePerson, makeStoreWithRoles } from "./test-roles";

afterAll(async () => {
  await dropStores();
  await dropPeople();
});

const aRole = (store: string, name: string, rank: number) => ({ storeId: store, name, rank, switches: ["view"] });
const anEvent = (store: string) => ({ storeId: store, actorName: "Van", event: "role_created" });

describe("role_definitions and access_events under row-level security", () => {
  it("show only the scoped store's rows, even without a store filter", async () => {
    const a = await makeStoreWithRoles("acc-rls-a");
    const b = await makeStoreWithRoles("acc-rls-b");
    await db.insert(accessEvents).values([anEvent(a.store), anEvent(b.store)]);
    // Deliberately no where clause: RLS alone must hide store B.
    const [roles, events] = await withStore(a.store, [db.select().from(roleDefinitions), db.select().from(accessEvents)] as const);
    expect(roles).toHaveLength(5);
    expect(roles.every((r) => r.storeId === a.store)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].storeId).toBe(a.store);
  });

  it("refuse an insert carrying another store's id", async () => {
    const a = await makeStoreWithRoles("acc-ins-a");
    const b = await makeStoreWithRoles("acc-ins-b");
    expect(await dbRefusal(withStore(a.store, [db.insert(roleDefinitions).values(aRole(b.store, "Smuggled", 250))]))).toMatch(
      /row-level security policy for table "role_definitions"/,
    );
    expect(await dbRefusal(withStore(a.store, [db.insert(accessEvents).values(anEvent(b.store))]))).toMatch(
      /row-level security policy for table "access_events"/,
    );
  });

  it("cannot change or delete another store's role", async () => {
    const a = await makeStoreWithRoles("acc-mut-a");
    const b = await makeStoreWithRoles("acc-mut-b");
    const target = eq(roleDefinitions.id, b.roles.vm_worker);
    const [updated, deleted] = await withStore(a.store, [
      db.update(roleDefinitions).set({ name: "Hijacked" }).where(target).returning({ id: roleDefinitions.id }),
      db.delete(roleDefinitions).where(target).returning({ id: roleDefinitions.id }),
    ] as const);
    expect(updated).toEqual([]);
    expect(deleted).toEqual([]);
    const [row] = await db.select().from(roleDefinitions).where(target);
    expect(row.name).toBe("Visual Merchandising Worker");
  });

  it("let the store role add to the log but never change or remove an entry", async () => {
    const a = await makeStoreWithRoles("acc-log");
    await withStore(a.store, [db.insert(accessEvents).values({ ...anEvent(a.store), detail: { role: "Sales Associate" } })]);
    const [entry] = await db.select().from(accessEvents).where(eq(accessEvents.storeId, a.store));
    expect(entry.detail).toEqual({ role: "Sales Associate" });
    expect(await dbRefusal(withStore(a.store, [db.update(accessEvents).set({ event: "rewritten" }).where(eq(accessEvents.id, entry.id))]))).toMatch(
      /permission denied for table access_events/,
    );
    expect(await dbRefusal(withStore(a.store, [db.delete(accessEvents).where(eq(accessEvents.id, entry.id))]))).toMatch(
      /permission denied for table access_events/,
    );
  });
});

describe("the store role's limits", () => {
  // withStore refuses an empty id, so the batch is built by hand, as withStore does.
  const asStoreRole = (setting: ReturnType<typeof sql> | null) =>
    db.batch([
      setting ? db.execute(setting) : db.execute(sql`select 1`),
      db.execute(sql`set local role app_store_user`),
      db.select().from(roleDefinitions),
      db.select().from(accessEvents),
    ] as const);

  it("fail closed: with app.store_id unset or empty, no role or log rows are visible", async () => {
    await makeStoreWithRoles("acc-closed");
    for (const setting of [null, sql`select set_config('app.store_id', '', true)`]) {
      const [, , roles, events] = await asStoreRole(setting);
      expect(roles).toEqual([]);
      expect(events).toEqual([]);
    }
  });

  it("is kept out of Better Auth's member and invitation tables", async () => {
    const { store } = await makeStoreWithRoles("acc-ba");
    expect(await dbRefusal(withStore(store, [db.select().from(member)]))).toMatch(/permission denied for table member/);
    expect(await dbRefusal(withStore(store, [db.select().from(invitation)]))).toMatch(/permission denied for table invitation/);
  });
});

describe("the composite foreign keys on member and invitation", () => {
  it("refuse a member holding another store's role, and accept one holding its own", async () => {
    const a = await makeStoreWithRoles("acc-fk-a");
    const b = await makeStoreWithRoles("acc-fk-b");
    await makePerson(a.store, a.roles.sales_associate);
    expect(await dbRefusal(makePerson(a.store, b.roles.sales_associate))).toMatch(/"member_role_fk"/);
    const { memberId } = await makePerson(a.store, null);
    expect(await dbRefusal(db.update(member).set({ roleId: b.roles.store_manager }).where(eq(member.id, memberId)))).toMatch(/"member_role_fk"/);
  });

  it("refuse an invitation naming another store's role, and accept one naming its own", async () => {
    const a = await makeStoreWithRoles("acc-inv-a");
    const b = await makeStoreWithRoles("acc-inv-b");
    const { userId } = await makePerson(a.store, a.roles.store_manager);
    await makeInvitation(a.store, userId, a.roles.vm_worker);
    await makeInvitation(a.store, userId, null);
    expect(await dbRefusal(makeInvitation(a.store, userId, b.roles.vm_worker))).toMatch(/"invitation_role_fk"/);
  });

  it("stop a role someone holds from being deleted, even by the store role, but let go of one nobody holds", async () => {
    const a = await makeStoreWithRoles("acc-del");
    const { userId } = await makePerson(a.store, a.roles.sales_associate);
    await makeInvitation(a.store, userId, a.roles.vm_worker);
    const drop = (id: string) => withStore(a.store, [db.delete(roleDefinitions).where(eq(roleDefinitions.id, id)).returning({ id: roleDefinitions.id })] as const);
    expect(await dbRefusal(drop(a.roles.sales_associate))).toMatch(/"member_role_fk" on table "member"/);
    expect(await dbRefusal(drop(a.roles.vm_worker))).toMatch(/"invitation_role_fk" on table "invitation"/);
    const [[gone]] = await drop(a.roles.vm_manager);
    expect(gone.id).toBe(a.roles.vm_manager);
  });

  // NO ACTION (not RESTRICT) is checked at the end of the statement, by which
  // point the cascade has removed the members, invitations and roles together.
  it("let a whole store be deleted, taking its roles, members, invitations and log with it", async () => {
    const { store, roles } = await makeStoreWithRoles("acc-org-delete");
    const { userId } = await makePerson(store, roles.store_manager, "owner");
    await makePerson(store, roles.vm_worker);
    await makeInvitation(store, userId, roles.sales_associate);
    await db.insert(accessEvents).values(anEvent(store));

    await db.delete(organization).where(eq(organization.id, store));

    expect(await db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, store))).toEqual([]);
    expect(await db.select().from(member).where(eq(member.organizationId, store))).toEqual([]);
    expect(await db.select().from(invitation).where(eq(invitation.organizationId, store))).toEqual([]);
    expect(await db.select().from(accessEvents).where(eq(accessEvents.storeId, store))).toEqual([]);
  });
});
