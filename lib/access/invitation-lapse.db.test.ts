// An invitation carries its inviter's authority (DECISIONS 11-12): accepting re-checks,
// in the accept statement itself, that the inviter is still in the store, still holds
// people.manage and still ranks strictly above the invitation's role. Otherwise the
// invitation has lapsed: it is refused and nothing is written.

import { neonConfig, Pool, type PoolClient } from "@neondatabase/serverless";
import { eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { invitation, member, user } from "@/db/auth-schema";
import { roleDefinitions } from "@/db/schema";
import { dropStores } from "@/lib/products/test-stores";

import { acceptInvitation } from "./invitation-accept";
import { actorIn, eventsOf, type Setup } from "./people-test";
import type { BuiltinRoleKey } from "./roles";
import { dropPeople, makeInvitation, makeStoreWithRoles } from "./test-roles";

// A transaction held open on a second connection needs a socket, not the HTTP driver the app uses.
neonConfig.webSocketConstructor = WebSocket;

const made: string[] = [];
afterAll(async () => {
  await dropStores();
  await dropPeople();
  if (made.length) await db.delete(user).where(inArray(user.id, made.splice(0)));
});

async function newcomer() {
  const id = `test_acc_${randomUUID().slice(0, 8)}`;
  made.push(id);
  const email = `lapse_${id}@example.test`;
  await db.insert(user).values({ id, name: "Nia Newcomer", email });
  return { id, name: "Nia Newcomer", email };
}

/**
 * A store with a bystander Store Manager (so a check that only asks "does anyone in the
 * store qualify" cannot pass by luck), an inviter in `inviterKey`, and a pending
 * invitation from them into `into` for a newcomer.
 */
async function setup(label: string, inviterKey: BuiltinRoleKey, into: BuiltinRoleKey) {
  const s = await makeStoreWithRoles(label);
  await actorIn(s, "store_manager");
  const inviter = await actorIn(s, inviterKey);
  const nia = await newcomer();
  const id = await makeInvitation(s.store, inviter.userId, s.roles[into]);
  await db.update(invitation).set({ email: nia.email }).where(eq(invitation.id, id));
  return { s, inviter, nia, id };
}

const statusOf = async (id: string) => (await db.select({ s: invitation.status }).from(invitation).where(eq(invitation.id, id)))[0].s;
const membersOf = (userId: string) => db.select().from(member).where(eq(member.userId, userId));

/** Refused as lapsed, with nothing written: no member, still pending, no event. */
async function expectLapsed(s: Setup, nia: { id: string; name: string; email: string }, id: string) {
  expect(await acceptInvitation(nia, id)).toEqual({ status: "lapsed" });
  expect(await membersOf(nia.id)).toEqual([]);
  expect(await statusOf(id)).toBe("pending");
  expect((await eventsOf(s.store)).filter((e) => e.event === "invitation_accepted")).toEqual([]);
}

describe("an invitation lapses when its inviter can no longer grant its role", () => {
  it("control: an inviter who is in the store, holds people.manage and outranks the role is accepted", async () => {
    const { s, nia, id } = await setup("lapse-ok", "vm_manager", "vm_worker");
    expect(await acceptInvitation(nia, id)).toMatchObject({ status: "accepted", roleName: "Visual Merchandising Worker" });
    expect(await membersOf(nia.id)).toHaveLength(1);
    expect((await eventsOf(s.store)).filter((e) => e.event === "invitation_accepted")).toHaveLength(1);
  });

  it("lapses when the inviter was removed from the store", async () => {
    const { s, inviter, nia, id } = await setup("lapse-removed", "vm_manager", "vm_worker");
    await db.delete(member).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter was re-roled to the invitation's rank, losing people.manage", async () => {
    const { s, inviter, nia, id } = await setup("lapse-equal", "vm_manager", "vm_worker");
    await db.update(member).set({ roleId: s.roles.vm_worker }).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter was re-roled to a role that still holds people.manage but ranks no higher than the invitation's", async () => {
    const { s, inviter, nia, id } = await setup("lapse-equal-manage", "assistant_manager", "vm_manager");
    await db.update(member).set({ roleId: s.roles.vm_manager }).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter was re-roled below the invitation's rank", async () => {
    const { s, inviter, nia, id } = await setup("lapse-below", "vm_manager", "vm_worker");
    await db.update(member).set({ roleId: s.roles.sales_associate }).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter's role lost people.manage", async () => {
    const { s, nia, id } = await setup("lapse-switch", "vm_manager", "vm_worker");
    await db.update(roleDefinitions).set({ switches: ["view", "products.stock"] }).where(eq(roleDefinitions.id, s.roles.vm_manager));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the invitation's role was moved up to the inviter's rank", async () => {
    const { s, nia, id } = await setup("lapse-moved", "vm_manager", "vm_worker");
    await db.update(roleDefinitions).set({ rank: 299 }).where(eq(roleDefinitions.id, s.roles.vm_worker));
    await expectLapsed(s, nia, id);
  });

  it("lapses when the inviter's member row has no role", async () => {
    const { s, inviter, nia, id } = await setup("lapse-norole", "vm_manager", "vm_worker");
    await db.update(member).set({ roleId: null }).where(eq(member.userId, inviter.userId));
    await expectLapsed(s, nia, id);
  });

  it("holds when a Store Manager's role row lists no people.manage: it is locked on, as everywhere else", async () => {
    const { s, nia, id } = await setup("lapse-locked", "store_manager", "vm_worker");
    await db.update(roleDefinitions).set({ switches: ["view"] }).where(eq(roleDefinitions.id, s.roles.store_manager));
    expect((await acceptInvitation(nia, id)).status).toBe("accepted");
  });
});

// The accept's lapse check locks the inviter's member row and role (invitation-lapse.ts `lock`), so a change
// that is still uncommitted when the accept starts is waited for, and the accept sees its result. Proved with
// a second connection: it opens a transaction, makes the change and holds it; the accept is shown to be blocked
// (a waiting backend in pg_stat_activity); only then does the change commit.
const pool = new Pool({ connectionString: process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL });
afterAll(() => pool.end());

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Whether some other backend is waiting on a lock inside the accept statement. */
async function acceptIsWaiting() {
  for (let i = 0; i < 40; i += 1) {
    const { rows } = await db.execute(sql`select 1 from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and wait_event_type = 'Lock' and query like '%update invitation i set status%'`);
    if (rows.length) return true;
    await sleep(250);
  }
  return false;
}

/** Runs `change` in an open transaction, starts the accept, waits until it is blocked, then commits. Returns the accept's outcome. */
async function acceptDuring(nia: { id: string; name: string; email: string }, id: string, change: (tx: PoolClient) => Promise<unknown>) {
  const tx = await pool.connect();
  let accepting: ReturnType<typeof acceptInvitation> | undefined;
  try {
    await tx.query("begin");
    await change(tx);
    accepting = acceptInvitation(nia, id);
    expect(await acceptIsWaiting()).toBe(true);
    await tx.query("commit");
  } catch (err) {
    await tx.query("rollback");
    throw err;
  } finally {
    tx.release();
  }
  return accepting;
}

describe("an inviter changed by a transaction that has not committed when the accept starts", () => {
  it("waits for the removal, then lapses and writes nothing", async () => {
    const { s, inviter, nia, id } = await setup("lapse-lock-member", "vm_manager", "vm_worker");
    const out = await acceptDuring(nia, id, (tx) => tx.query("delete from member where user_id = $1", [inviter.userId]));
    expect(out).toEqual({ status: "lapsed" });
    await expectLapsed(s, nia, id);
  }, 30_000);

  it("waits for the inviter's role to lose people.manage, then lapses and writes nothing", async () => {
    const { s, nia, id } = await setup("lapse-lock-role", "vm_manager", "vm_worker");
    const out = await acceptDuring(nia, id, (tx) => tx.query("update role_definitions set switches = array['view']::text[] where id = $1", [s.roles.vm_manager]));
    expect(out).toEqual({ status: "lapsed" });
    await expectLapsed(s, nia, id);
  }, 30_000);
});
