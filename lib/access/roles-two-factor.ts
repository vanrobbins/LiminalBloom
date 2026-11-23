// "Requires two-factor" on a role (spec 0.7.1 1, A3b): whoever holds the role must have two-factor sign-in
// before the app shows them anything but Account (lib/current-member.ts). It is a setting of the role, not
// one of the switches, so it is edited on its own, one statement like the rename: pinned to the version
// and rank the person saw, with its access_events row in the same statement. The rank rule is the one every
// role edit has: roles.manage and a role strictly below your own. Runs as the table owner, filtered by the
// store id by hand (roles-write.ts).

import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { roleDefinitions } from "@/db/schema";

import { canActOn } from "./rank";
import { isRefusal, runRoleWrite, type RoleRefusal, type RolesActor } from "./roles-write";

export type RequireTwoFactorOutcome = { status: "set"; name: string; on: boolean } | RoleRefusal;

export async function setRequiresTwoFactor(storeId: string, actor: RolesActor, roleId: string, version: number, on: boolean): Promise<RequireTwoFactorOutcome> {
  const [role] = await db.select().from(roleDefinitions).where(and(eq(roleDefinitions.storeId, storeId), eq(roleDefinitions.id, roleId)));
  if (!role) return { status: "gone" };
  if (!canActOn(actor, role.rank, "roles.manage")) return { status: "forbidden" };
  if (role.version !== version) return { status: "stale" };
  if (role.requiresTwoFactor === on) return { status: "invalid" };
  const done = await runRoleWrite(sql`
    with changed as (
      update role_definitions r set requires_two_factor = ${on}, version = r.version + 1, updated_at = now()
      where r.store_id = ${storeId} and r.id = ${roleId} and r.version = ${version} and r.rank = ${role.rank}::int and r.requires_two_factor <> ${on}
      returning r.name),
    logged as (
      insert into access_events (store_id, actor_id, actor_name, event, detail)
      select ${storeId}::text, ${actor.userId}::text, ${actor.name}::text, 'role_two_factor_changed', jsonb_build_object('role', c.name, 'on', ${on}::boolean) from changed c returning id)
    select id from logged`);
  if (isRefusal(done)) return done;
  if (done.rows.length === 1) return { status: "set", name: role.name, on };
  const [again] = await db.select({ id: roleDefinitions.id }).from(roleDefinitions).where(and(eq(roleDefinitions.storeId, storeId), eq(roleDefinitions.id, roleId)));
  return { status: again ? "stale" : "gone" };
}
