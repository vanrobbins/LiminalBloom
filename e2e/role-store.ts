// The shared store the per-role accounts work in (test-account.ts: ROLE_STORE). Setup creates it with the
// Store Manager account, adds the other four people to it, and gives it a product for each worker to change
// the status of, and a waiting invitation, so a role that must not see invitations has one to not see.
// Rows are written straight to the development database as the owner, because setup is not what is being tested.

import { randomUUID } from "node:crypto";

import type { BuiltinRoleKey } from "../lib/access/roles";

import { sql } from "./map-store";
import { E2E_WORKERS, ROLE_STORE, roleAccount } from "./test-account";

/** The role store's id, found through the Store Manager account that made it; null before setup has made it. */
export async function roleStoreId(): Promise<string | null> {
  const [row] = await sql()`
    select o.id from organization o
    join member m on m.organization_id = o.id
    join "user" u on u.id = m.user_id
    where u.email = ${roleAccount("store_manager").email} and o.name = ${ROLE_STORE}
    limit 1`;
  return row ? String(row.id) : null;
}

/** Puts a signed-up account in the store with its role. Safe to repeat; a person already in is moved to the role. */
export async function placeRoleAccount(store: string, key: BuiltinRoleKey): Promise<void> {
  const db = sql();
  const [role] = await db`select id from role_definitions where store_id = ${store} and builtin = ${key}`;
  const [account] = await db`select id from "user" where email = ${roleAccount(key).email}`;
  const [already] = await db`select id from member where organization_id = ${store} and user_id = ${account.id}`;
  if (already) await db`update member set role_id = ${role.id} where id = ${already.id}`;
  else await db`insert into member (id, organization_id, user_id, role, created_at, role_id) values (${randomUUID()}, ${store}, ${account.id}, 'member', now(), ${role.id})`;
}

/** Each worker changes the status of its own product, so two workers never meet on one. */
export const roleProduct = (worker: number) => ({ name: `E2E Role Tee ${worker}`, style: `E2E-ROLE-${worker}` });

export const INVITED = "pending.person@example.test";

/** The store's products and its one waiting invitation, made fresh. */
export async function seedRoleStore(store: string): Promise<void> {
  const db = sql();
  await db`delete from product_categories where store_id = ${store} and name = 'E2E Roles'`;
  const [category] = await db`insert into product_categories (store_id, name, hung_columns, folded_columns) values (${store}, 'E2E Roles', 2, 4) returning id`;
  for (let worker = 0; worker < E2E_WORKERS; worker++) {
    const { name, style } = roleProduct(worker);
    await db`insert into products (store_id, name, style_number, category_id, color) values (${store}, ${name}, ${style}, ${category.id}, 'Navy')`;
  }
  await db`delete from invitation where organization_id = ${store}`;
  // Weeks, not the usual 48 hours: the invitation must still be waiting whenever the specs run.
  const expiresAt = new Date(Date.now() + 14 * 24 * 3_600_000).toISOString();
  await db`insert into invitation (id, organization_id, email, role, status, expires_at, inviter_id, role_id)
    values (${randomUUID()}, ${store}, ${INVITED}, 'member', 'pending', ${expiresAt},
      (select id from "user" where email = ${roleAccount("store_manager").email}),
      (select id from role_definitions where store_id = ${store} and builtin = 'sales_associate'))`;
}

/** Puts a worker's product back in stock, for a test that changed it. */
export async function resetRoleProduct(worker: number): Promise<void> {
  const store = await roleStoreId();
  await sql()`update products set status = 'in_stock' where store_id = ${store} and style_number = ${roleProduct(worker).style}`;
}
