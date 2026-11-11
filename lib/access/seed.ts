// A store's five built-in roles, and its people's role_id (spec 0.7). Called by
// the store-creation hook (lib/auth.ts), which imports this file inside the hook
// because of `server-only` (the Better Auth CLI loads lib/auth.ts outside Next.js).

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { BUILTIN_ROLES } from "./roles";

/**
 * Give a store the built-in roles it is missing, then a role to every member
 * who has none. Safe to run any number of times.
 *
 * - A built-in the store already has is left exactly as it is: a store may have
 *   renamed it or changed its switches.
 * - A built-in is also left out, without an error, when the store has since taken
 *   its default rank or name for another role. Its members keep a null role_id
 *   until a person gives them one; failing here would remove a store over a rank.
 * - member.role_id is set from Better Auth's member.role exactly as migration
 *   0018 does: contains owner, Store Manager; else contains admin, Assistant
 *   Manager; else Sales Associate (comma-separated, spaces ignored).
 *
 * A re-run gives a role to EVERY member whose role_id is null, mapped from their
 * Better Auth role. Do not run it on a store where a null was set on purpose.
 * Today nothing sets a null on purpose.
 *
 * Runs as the table owner, not through withStore: it writes Better Auth's
 * `member` table, which the store role (app_store_user) cannot reach. Every
 * statement is therefore filtered by the store id. All statements go in one
 * batch, so they succeed or fail together. If the store ends with no Store
 * Manager role (its name or rank is taken), one warning is logged and nothing throws.
 */
export async function giveStoreItsRoles(storeId: string): Promise<void> {
  if (!storeId) throw new Error("giveStoreItsRoles needs a store id.");

  const wanted = BUILTIN_ROLES.map(
    (r) =>
      sql`(${r.key}::text, ${r.name}::text, ${r.rank}::int, ARRAY[${sql.join(
        r.switches.map((s) => sql`${s}`),
        sql`, `,
      )}]::text[])`,
  );

  const [, , managers] = await db.batch([
    // Not ON CONFLICT: the rank constraint is deferrable, which ON CONFLICT cannot arbitrate.
    db.execute(sql`
      insert into role_definitions (store_id, builtin, name, rank, switches)
      select ${storeId}, b.builtin, b.name, b.rank, b.switches
      from (values ${sql.join(wanted, sql`, `)}) as b(builtin, name, rank, switches)
      where not exists (
        select 1 from role_definitions r
        where r.store_id = ${storeId}
          and (r.builtin = b.builtin or r.rank = b.rank or lower(r.name) = lower(b.name))
      )`),
    db.execute(sql`
      update member m set role_id = r.id
      from role_definitions r
      where m.organization_id = ${storeId}
        and m.role_id is null
        and r.store_id = m.organization_id
        and r.builtin = case
          when 'owner' = any (string_to_array(replace(m.role, ' ', ''), ',')) then 'store_manager'
          when 'admin' = any (string_to_array(replace(m.role, ' ', ''), ',')) then 'assistant_manager'
          else 'sales_associate'
        end`),
    db.execute(sql`select 1 as found from role_definitions where store_id = ${storeId} and builtin = 'store_manager'`),
  ]);

  const found = Array.isArray(managers) ? managers : (managers as { rows: unknown[] }).rows;
  if (found.length === 0) {
    console.warn(
      `Store ${storeId} has no Store Manager role because its name or rank is taken, so its owner was given no role.`,
    );
  }
}
