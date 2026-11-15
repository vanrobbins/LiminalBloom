// What the invitation page and /welcome read, from the dev database (spec 0.7,
// 4.8): the state of one invitation for whoever is looking, and the pending ones
// for one email. The id is the secret, so nothing here lists by store.

import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member, organization, user } from "@/db/auth-schema";
import { dropStores } from "@/lib/products/test-stores";

import { lookInvitation, pendingInvitationsFor } from "./invitation-look";
import { actorIn, type Setup } from "./people-test";
import { dropPeople, makeInvitation, makeStoreWithRoles } from "./test-roles";

const made: string[] = [];
afterAll(async () => {
  await dropStores();
  await dropPeople();
  if (made.length) await db.delete(user).where(inArray(user.id, made.splice(0)));
});

async function viewer(email = `look_${randomUUID().slice(0, 8)}@example.test`) {
  const id = `test_acc_${randomUUID().slice(0, 8)}`;
  made.push(id);
  await db.insert(user).values({ id, name: "Val Viewer", email });
  return { id, name: "Val Viewer", email };
}

async function invite(s: Setup, email: string, extra: Partial<typeof invitation.$inferInsert> = {}) {
  const inviter = await actorIn(s, "store_manager");
  const id = await makeInvitation(s.store, inviter.userId, s.roles.vm_manager);
  await db.update(invitation).set({ email, ...extra }).where(eq(invitation.id, id));
  return id;
}

const storeName = async (id: string) => (await db.select({ n: organization.name }).from(organization).where(eq(organization.id, id)))[0].n;

describe("lookInvitation", () => {
  it("says ready for the invited email, in any letter case, with the store and role names", async () => {
    const s = await makeStoreWithRoles("look-ready");
    const v = await viewer("Val.Viewer@Example.Test");
    const id = await invite(s, "val.viewer@example.test");
    expect(await lookInvitation(id, v)).toEqual({ state: "ready", storeName: await storeName(s.store), roleName: "Visual Merchandising Manager" });
  });

  it("shows a signed-out visitor the store and role, and never the invited address", async () => {
    const s = await makeStoreWithRoles("look-out");
    const id = await invite(s, "secret.address@example.test");
    const look = await lookInvitation(id, null);
    expect(look).toEqual({ state: "signed-out", storeName: await storeName(s.store), roleName: "Visual Merchandising Manager" });
    expect(JSON.stringify(look)).not.toContain("secret.address");
  });

  it("says wrong-email to someone else, without saying whose it is", async () => {
    const s = await makeStoreWithRoles("look-wrong");
    const v = await viewer();
    const id = await invite(s, "other.person@example.test");
    const look = await lookInvitation(id, v);
    expect(look.state).toBe("wrong-email");
    expect(JSON.stringify(look)).not.toContain("other.person");
  });

  it("says expired, cancelled, used and missing, whoever looks", async () => {
    const s = await makeStoreWithRoles("look-spent");
    const v = await viewer();
    const expired = await invite(s, v.email, { expiresAt: new Date(Date.now() - 1000) });
    const cancelled = await invite(s, v.email, { status: "canceled" });
    const used = await invite(s, v.email, { status: "accepted" });
    const rejected = await invite(s, v.email, { status: "rejected" });
    for (const who of [v, null]) {
      expect((await lookInvitation(expired, who)).state).toBe("expired");
      expect((await lookInvitation(cancelled, who)).state).toBe("cancelled");
      expect((await lookInvitation(used, who)).state).toBe("used");
      expect((await lookInvitation(rejected, who)).state).toBe("cancelled");
      expect((await lookInvitation("no-such-invitation", who)).state).toBe("missing");
    }
    const noRole = await invite(s, v.email, { roleId: null });
    expect((await lookInvitation(noRole, v)).state).toBe("missing");
  });

  it("says already-member for someone in the store, and full when the store has 100 people", async () => {
    const s = await makeStoreWithRoles("look-member");
    const v = await viewer();
    await db.insert(member).values({ id: randomUUID(), organizationId: s.store, userId: v.id, role: "member", roleId: s.roles.sales_associate, createdAt: new Date() });
    const id = await invite(s, v.email);
    expect((await lookInvitation(id, v)).state).toBe("already-member");

    const full = await makeStoreWithRoles("look-full");
    const ids = Array.from({ length: 100 }, (_, i) => `test_acc_lookfull_${randomUUID().slice(0, 6)}_${i}`);
    made.push(...ids);
    await db.insert(user).values(ids.map((uid) => ({ id: uid, name: uid, email: `${uid}@example.com` })));
    await db.insert(member).values(ids.map((uid) => ({ id: `m_${uid}`, organizationId: full.store, userId: uid, role: "member", roleId: full.roles.sales_associate, createdAt: new Date() })));
    const other = await viewer();
    expect((await lookInvitation(await invite(full, other.email), other)).state).toBe("full");
  });
});

describe("pendingInvitationsFor", () => {
  it("lists one email's waiting invitations across stores, newest first, and nothing else", async () => {
    const a = await makeStoreWithRoles("look-list-a");
    const b = await makeStoreWithRoles("look-list-b");
    const v = await viewer("Lena.List@Example.Test");
    const first = await invite(a, "lena.list@example.test");
    const second = await invite(b, "LENA.LIST@example.test", { createdAt: new Date(Date.now() + 1000) });
    const skipped = [await invite(a, "lena.list@example.test", { expiresAt: new Date(Date.now() - 1000) }), await invite(a, "lena.list@example.test", { status: "canceled" })];
    await invite(b, "somebody.else@example.test");
    const list = await pendingInvitationsFor(v);
    expect(list.map((i) => i.storeName)).toEqual([await storeName(b.store), await storeName(a.store)]);
    expect(list[0]).toMatchObject({ storeName: await storeName(b.store), roleName: "Visual Merchandising Manager" });
    expect(typeof list[0].expiresAt).toBe("string");
    // The link is the secret (spec 4.9), and /welcome is open to anyone who signs up with the address:
    // what leaves this read names the store, role and expiry, and nothing that opens an invitation.
    expect(list.map((i) => Object.keys(i).sort())).toEqual([["expiresAt", "roleName", "storeName"], ["expiresAt", "roleName", "storeName"]]);
    const serialised = JSON.stringify(list);
    for (const id of [first, second, ...skipped]) expect(serialised).not.toContain(id);
  });

  it("skips a store the person is already in", async () => {
    const s = await makeStoreWithRoles("look-list-in");
    const v = await viewer();
    await db.insert(member).values({ id: randomUUID(), organizationId: s.store, userId: v.id, role: "member", roleId: s.roles.sales_associate, createdAt: new Date() });
    await invite(s, v.email);
    expect(await pendingInvitationsFor(v)).toEqual([]);
  });
});
