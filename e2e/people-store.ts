// People for the People screen's e2e tests. The test account is the Store Manager of
// its home store (it created it); this adds the rest of a team to that store with
// rows written straight to the development database, as the owner, because setup is
// not what is being tested. These people have no password and cannot sign in: what
// each role sees is tested with the per-role accounts (role-store.ts, access-*.spec.ts).

import { randomUUID } from "node:crypto";

import { HOME_STORE, TEST_ACCOUNT } from "./test-account";
import { sql, storeId } from "./map-store";

export type Builtin = "store_manager" | "assistant_manager" | "vm_manager" | "vm_worker" | "sales_associate";

const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0);
const PREFIX = `e2e_people_${worker}_`;

export const TEAM: { name: string; role: Builtin }[] = [
  { name: "Sue Manager", role: "store_manager" },
  { name: "Ann Assistant", role: "assistant_manager" },
  { name: "Vic Manager", role: "vm_manager" },
  { name: "Wes Worker", role: "vm_worker" },
  { name: "Zoe Sales", role: "sales_associate" },
  { name: "Abe Sales", role: "sales_associate" },
];

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, ".");
export const emailOf = (name: string) => `${PREFIX}${slug(name)}@example.com`;

async function roleIds(store: string): Promise<Record<string, string>> {
  const rows = await sql()`select id, builtin from role_definitions where store_id = ${store}`;
  return Object.fromEntries(rows.map((r) => [String(r.builtin), String(r.id)]));
}

/** Removes everyone added here, their invitations, and the log entries the tests made. */
export async function clearPeople(): Promise<void> {
  const db = sql();
  const store = await storeId(HOME_STORE);
  // The tests invite addresses at example.test; nothing else uses that domain.
  await db`delete from invitation where organization_id = ${store} and email like ${"%@example.test"}`;
  // invite.spec invites the test account itself, to see the "already in this store" message.
  await db`delete from invitation where organization_id = ${store} and email = ${TEST_ACCOUNT.email}`;
  await db`delete from "user" where id like ${`${PREFIX}%`}`;
  // People who signed up from an invitation have Better Auth's own ids; their address marks them.
  await db`delete from "user" where email like ${`${PREFIX}invitee.%@example.test`}`;
  await db`delete from access_events where store_id = ${store}`;
}

/** A fresh address for someone who will sign up from an invitation; clearPeople removes the account. */
export const inviteeEmail = () => `${PREFIX}invitee.${randomUUID().slice(0, 8)}@example.test`;

export async function seedTeam(team = TEAM): Promise<void> {
  await clearPeople();
  const db = sql();
  const store = await storeId(HOME_STORE);
  const roles = await roleIds(store);
  for (const { name, role } of team) {
    const id = `${PREFIX}${slug(name)}`;
    await db`insert into "user" (id, name, email, email_verified) values (${id}, ${name}, ${emailOf(name)}, false)`;
    await db`insert into member (id, organization_id, user_id, role, created_at, role_id) values (${randomUUID()}, ${store}, ${id}, 'member', now(), ${roles[role]})`;
  }
}

/** A pending invitation into a role, from the test account. `expired` backdates its expiry. */
export async function seedInvitation(email: string, role: Builtin, expired = false): Promise<string> {
  const db = sql();
  const store = await storeId(HOME_STORE);
  const roles = await roleIds(store);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + (expired ? -3_600_000 : 48 * 3_600_000));
  await db`insert into invitation (id, organization_id, email, role, status, expires_at, inviter_id, role_id)
    values (${id}, ${store}, ${email}, 'member', 'pending', ${expiresAt.toISOString()}, (select id from "user" where email = ${TEST_ACCOUNT.email}), ${roles[role]})`;
  return id;
}

/** Changes an invitation's status behind the page's back: canceled, accepted. */
export async function setInvitationStatus(id: string, status: string): Promise<void> {
  await sql()`update invitation set status = ${status} where id = ${id}`;
}

/** Another session changes someone's role while a dialog is open. */
export async function setRoleBehindTheScenes(name: string, role: Builtin): Promise<void> {
  const db = sql();
  const roles = await roleIds(await storeId(HOME_STORE));
  await db`update member set role_id = ${roles[role]} where user_id = ${`${PREFIX}${slug(name)}`}`;
}

export async function removeBehindTheScenes(name: string): Promise<void> {
  await sql()`delete from member where user_id = ${`${PREFIX}${slug(name)}`}`;
}

/** The access log's events for the home store, newest first. */
export async function loggedEvents(): Promise<string[]> {
  const store = await storeId(HOME_STORE);
  const rows = await sql()`select event from access_events where store_id = ${store} order by created_at desc`;
  return rows.map((r) => String(r.event));
}
