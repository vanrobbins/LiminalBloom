// Roles for the Roles screen's e2e tests. Every test changes the home store's roles (names, permissions, order,
// custom roles), and roles are shared by every spec that runs on that store, so each spec resets them after
// each test: built-ins back to what they ship with, custom roles gone. Rows are written straight to the
// development database as the owner, because setup is not what is being tested.

import { randomUUID } from "node:crypto";

import { BUILTIN_ROLES } from "../lib/access/roles";

import { HOME_STORE, TEST_ACCOUNT } from "./test-account";
import { sql, storeId } from "./map-store";
import { clearPeople } from "./people-store";

const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0);

/** Puts the home store's roles back to their defaults and clears everyone and everything the tests made. */
export async function resetRoles(): Promise<void> {
  await clearPeople();
  const db = sql();
  const store = await storeId(HOME_STORE);
  // Anyone or anything still on a custom role goes to the lowest built-in, so the role can be deleted.
  const lowest = BUILTIN_ROLES[BUILTIN_ROLES.length - 1];
  const [sa] = await db`select id from role_definitions where store_id = ${store} and builtin = ${lowest.key}`;
  await db`update member set role_id = ${sa.id} where organization_id = ${store} and role_id in (select id from role_definitions where store_id = ${store} and builtin is null)`;
  await db`update invitation set role_id = null where organization_id = ${store} and role_id in (select id from role_definitions where store_id = ${store} and builtin is null)`;
  await db`delete from role_definitions where store_id = ${store} and builtin is null`;
  // Two passes: the name index is checked row by row, so a swap of names would collide in one.
  await db`update role_definitions set name = id where store_id = ${store}`;
  for (const r of BUILTIN_ROLES) {
    await db`update role_definitions set name = ${r.name}, rank = ${r.rank}, switches = ${[...r.switches]}, version = version + 1, updated_at = now() where store_id = ${store} and builtin = ${r.key}`;
  }
  await db`update role_definitions set updated_at = now() where store_id = ${store} and builtin = 'store_manager'`;
}

async function builtinId(key: string): Promise<{ store: string; id: string }> {
  const store = await storeId(HOME_STORE);
  const [row] = await sql()`select id from role_definitions where store_id = ${store} and builtin = ${key}`;
  return { store, id: String(row.id) };
}

/** Another session changes a built-in's permissions while the screen is open. */
export async function setSwitchesBehindTheScenes(key: string, switches: string[]): Promise<void> {
  const { id } = await builtinId(key);
  await sql()`update role_definitions set switches = ${switches}, version = version + 1 where id = ${id}`;
}

/** A custom role with the given permissions and rank, made directly. Returns its id. */
export async function seedCustomRole(name: string, rank: number, switches: string[]): Promise<string> {
  const store = await storeId(HOME_STORE);
  const [row] = await sql()`insert into role_definitions (store_id, name, rank, switches) values (${store}, ${name}, ${rank}, ${switches}) returning id`;
  return String(row.id);
}

/** A person (no password, can't sign in) holding a custom role, and a waiting invitation if asked. */
export async function seedHolder(name: string, roleId: string): Promise<void> {
  const db = sql();
  const store = await storeId(HOME_STORE);
  const id = `e2e_people_${worker}_${name.toLowerCase().replace(/\s+/g, ".")}`;
  await db`insert into "user" (id, name, email, email_verified) values (${id}, ${name}, ${`${id}@example.com`}, false)`;
  await db`insert into member (id, organization_id, user_id, role, created_at, role_id) values (${randomUUID()}, ${store}, ${id}, 'member', now(), ${roleId})`;
}

export async function seedInvitationTo(email: string, roleId: string): Promise<void> {
  const store = await storeId(HOME_STORE);
  await sql()`insert into invitation (id, organization_id, email, role, status, expires_at, inviter_id, role_id)
    values (${randomUUID()}, ${store}, ${email}, 'member', 'pending', ${new Date(Date.now() + 48 * 3_600_000).toISOString()}, (select id from "user" where email = ${TEST_ACCOUNT.email}), ${roleId})`;
}

/** The roles of the home store in rank order, as stored. */
export async function storedRoles(): Promise<{ name: string; rank: number; switches: string[]; builtin: string | null }[]> {
  const store = await storeId(HOME_STORE);
  const rows = await sql()`select name, rank, switches, builtin from role_definitions where store_id = ${store} order by rank`;
  return rows.map((r) => ({ name: String(r.name), rank: Number(r.rank), switches: r.switches as string[], builtin: (r.builtin as string | null) ?? null }));
}

export async function roleOfPerson(name: string): Promise<string> {
  const id = `e2e_people_${worker}_${name.toLowerCase().replace(/\s+/g, ".")}`;
  const [row] = await sql()`select r.name from member m join role_definitions r on r.id = m.role_id where m.user_id = ${id}`;
  return String(row?.name);
}
