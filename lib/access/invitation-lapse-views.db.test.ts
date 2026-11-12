// A lapsed invitation (its inviter can no longer grant its role, DECISIONS 11-12) is
// treated like an expired one wherever the code handles expiry: the invitation page's
// read, /welcome's list, People's invitations card, and the duplicate and 100-invitation
// checks when someone new invites.

import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import type { Member } from "@/lib/current-member";
import { dropStores } from "@/lib/products/test-stores";

import { lookInvitation, pendingInvitationsFor } from "./invitation-look";
import { createInvitation, MAX_INVITATIONS } from "./invite";
import { peopleViewFor } from "./people";
import { actorIn, type Setup } from "./people-test";
import { BUILTIN_ROLES } from "./roles";
import { dropPeople, makeInvitation, makeStoreWithRoles } from "./test-roles";

const made: string[] = [];
afterAll(async () => {
  await dropStores();
  await dropPeople();
  if (made.length) await db.delete(user).where(inArray(user.id, made.splice(0)));
});

/** A store with a manager, and a pending invitation from a Visual Merchandising Manager who has since been removed. */
async function lapsed(label: string) {
  const s = await makeStoreWithRoles(label);
  const manager = await actorIn(s, "store_manager");
  const inviter = await actorIn(s, "vm_manager");
  const id = await makeInvitation(s.store, inviter.userId, s.roles.vm_worker);
  const email = `lapse_${randomUUID().slice(0, 8)}@example.test`;
  await db.update(invitation).set({ email }).where(eq(invitation.id, id));
  await db.delete(member).where(eq(member.userId, inviter.userId));
  return { s, manager, id, email };
}

async function viewer(email: string) {
  const id = `test_acc_${randomUUID().slice(0, 8)}`;
  made.push(id);
  await db.insert(user).values({ id, name: "Val Viewer", email });
  return { id, email };
}

const memberView = (s: Setup, userId: string): Member => {
  const def = BUILTIN_ROLES[0];
  return { kind: "member", user: { id: userId, name: "Manager", email: `${userId}@example.com` }, stores: [], activeStoreId: s.store, role: { id: s.roles.store_manager, name: def.name, rank: def.rank }, switches: [...def.switches] };
};

describe("a lapsed invitation", () => {
  it("is read as lapsed, with the store and role, by anyone who has the link (signed out, invited, someone else)", async () => {
    const { id, email } = await lapsed("lv-look");
    const invited = await viewer(email);
    const stranger = await viewer(`other_${randomUUID().slice(0, 8)}@example.test`);
    for (const who of [null, invited, stranger]) {
      expect(await lookInvitation(id, who)).toMatchObject({ state: "lapsed", roleName: "Visual Merchandising Worker" });
    }
  });

  it("is not listed on /welcome", async () => {
    const { email } = await lapsed("lv-welcome");
    expect(await pendingInvitationsFor(await viewer(email))).toEqual([]);
  });

  it("is marked lapsed on People's invitations card, and can still be cancelled", async () => {
    const { s, manager, id } = await lapsed("lv-people");
    const view = await peopleViewFor(memberView(s, manager.userId));
    expect(view.invitations).toHaveLength(1);
    expect(view.invitations[0]).toMatchObject({ id, lapsed: true, expired: false, canAct: true });
  });

  it("does not block a new invitation to the same address", async () => {
    const { s, manager, email } = await lapsed("lv-dup");
    expect((await createInvitation(s.store, manager, email, s.roles.sales_associate)).status).toBe("created");
  });

  it("is not counted toward the 100 waiting invitations", async () => {
    const { s, manager } = await lapsed("lv-cap");
    const ids = Array.from({ length: MAX_INVITATIONS - 1 }, () => randomUUID());
    await db.insert(invitation).values(ids.map((id) => ({ id, organizationId: s.store, email: `${id}@example.com`, roleId: s.roles.sales_associate, expiresAt: new Date(Date.now() + 3_600_000), inviterId: manager.userId })));
    // The one lapsed invitation plus 99 more is 100 rows: at the cap if lapsed ones counted.
    expect((await createInvitation(s.store, manager, "last@example.test", s.roles.sales_associate)).status).toBe("created");
  });
});
