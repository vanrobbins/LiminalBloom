// Setup and checks for the admin help-action specs (0.7.1a, A5/A6): people, invitations and two-factor rows written
// straight to the development database as the owner, because setup is not what is being tested. Everything is
// keyed by the reason prefix or the e2e_adminact_ ids, so clearActionData removes exactly what the specs made.

import { randomUUID } from "node:crypto";

import { sql } from "./map-store";

/** Every reason the specs type starts with this, so their log rows can be found and removed. */
export const REASON = "e2e admin actions";
const PREFIX = `e2e_adminact_${Number(process.env.TEST_PARALLEL_INDEX ?? 0)}_`;

/** The store a disposable account created. */
export async function storeOf(email: string): Promise<string> {
  const rows = await sql()`select o.id from organization o join member m on m.organization_id = o.id join "user" u on u.id = m.user_id where u.email = ${email} limit 1`;
  if (typeof rows[0]?.id !== "string") throw new Error(`No store for ${email}.`);
  return rows[0].id;
}

/** A Sales Associate in the store, who cannot sign in. */
export async function seedWorker(store: string, name: string): Promise<string> {
  const db = sql();
  const id = `${PREFIX}${randomUUID().slice(0, 8)}`;
  await db`insert into "user" (id, name, email, email_verified) values (${id}, ${name}, ${`${id}@example.test`}, false)`;
  await db`insert into member (id, organization_id, user_id, role, created_at, role_id)
    values (${randomUUID()}, ${store}, ${id}, 'member', now(), (select id from role_definitions where store_id = ${store} and builtin = 'sales_associate'))`;
  return id;
}

/** A pending invitation to the store, sent by the store's first member. */
export async function seedPendingInvitation(store: string, email: string): Promise<string> {
  const id = randomUUID();
  await sql()`insert into invitation (id, organization_id, email, role, status, expires_at, inviter_id, role_id)
    values (${id}, ${store}, ${email}, 'member', 'pending', ${new Date(Date.now() + 48 * 3_600_000).toISOString()},
      (select user_id from member where organization_id = ${store} limit 1), (select id from role_definitions where store_id = ${store} and builtin = 'sales_associate'))`;
  return id;
}

export async function invitationStatus(id: string): Promise<string | undefined> {
  const rows = await sql()`select status from invitation where id = ${id}`;
  return rows[0]?.status as string | undefined;
}

/** The built-in a person holds in a store. */
export async function builtinOf(userId: string, store: string): Promise<string | undefined> {
  const rows = await sql()`select rd.builtin from member m join role_definitions rd on rd.store_id = m.organization_id and rd.id = m.role_id where m.user_id = ${userId} and m.organization_id = ${store}`;
  return rows[0]?.builtin as string | undefined;
}

/** Gives an account an authenticator app (a row and the flag), as if it had set one up. */
export async function seedTwoFactor(email: string): Promise<void> {
  const db = sql();
  await db`update "user" set two_factor_enabled = true where email = ${email}`;
  await db`insert into two_factor (id, secret, backup_codes, user_id) values (${randomUUID()}, 'e2e-secret', 'e2e-codes', (select id from "user" where email = ${email}))`;
}

export async function twoFactorRows(email: string): Promise<number> {
  const rows = await sql()`select count(*)::int as n from two_factor where user_id = (select id from "user" where email = ${email})`;
  return Number(rows[0].n);
}

export async function isAdmin(email: string): Promise<boolean> {
  const rows = await sql()`select 1 from platform_admins where user_id = (select id from "user" where email = ${email})`;
  return rows.length === 1;
}

/** Removes the people made here and the specs' log rows (platform_events is insert-only: its trigger is off for the delete, in one transaction). */
export async function clearActionData(): Promise<void> {
  const db = sql();
  await db`delete from "user" where id like ${`${PREFIX}%`}`;
  await db.transaction([
    db`alter table platform_events disable trigger user`,
    db`delete from platform_events where reason like ${`${REASON}%`}`,
    db`alter table platform_events enable trigger user`,
  ]);
}
