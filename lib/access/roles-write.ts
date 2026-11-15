// Shared by the role writes (spec 0.7, 4.8 and the nesting rule, DECISIONS 11-11):
// what a refusal looks like, reading the store's roles, and the checks every
// write makes first. Each write is ONE SQL statement that changes the rows and
// inserts its access_events rows together, pinned to what the person saw, as
// people-write.ts does; the pre-checks here only give the refusal its reason, and
// the statement holds the same rules however it was reached.
//
// Runs as the table owner, not through withStore, like people-write.ts: every
// statement is filtered by the store id by hand, and the actor is the member the
// action's guard resolved on this request, never the browser's claim.

import "server-only";

import { asc, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { roleDefinitions } from "@/db/schema";

import type { NestingProblem } from "./nesting";
import type { Actor } from "./rank";
import { cleanSwitches, type Switch } from "./switches";

export type RolesActor = Actor & { userId: string; name: string };

export type RoleRefusal =
  | { status: "forbidden" | "stale" | "gone" | "invalid" | "taken" | "rank" | "grant" | "locked" | "empty-name" | "long-name" | "cant-move-people" }
  | { status: "nesting"; problem: NestingProblem };

export type DbRole = { id: string; name: string; rank: number; builtin: string | null; version: number; switches: Switch[] };

/** The store's roles in rank order and the Store Manager row's `updated_at` as text (see `stampRoles`). */
export type Snapshot = { roles: DbRole[]; stamp: string | null };

export const MAX_NAME = 40;

export function checkName(raw: string): { ok: true; name: string } | { ok: false; status: "empty-name" | "long-name" } {
  const name = raw.trim();
  if (name === "") return { ok: false, status: "empty-name" };
  return name.length > MAX_NAME ? { ok: false, status: "long-name" } : { ok: true, name };
}

export async function readSnapshot(storeId: string): Promise<Snapshot> {
  // The stamp first: a role added between the two reads then fails the write's pin instead of slipping past it.
  const stamp = await db.execute(sql`select updated_at::text as stamp from role_definitions where store_id = ${storeId} and builtin = 'store_manager'`);
  const rows = await db.select().from(roleDefinitions).where(eq(roleDefinitions.storeId, storeId)).orderBy(asc(roleDefinitions.rank));
  return {
    stamp: (stamp.rows[0]?.stamp as string | undefined) ?? null,
    roles: rows.map((r) => ({ id: r.id, name: r.name, rank: r.rank, builtin: r.builtin, version: r.version, switches: [...cleanSwitches(r.switches)] })),
  };
}

export async function rowsOf(write: SQL): Promise<Record<string, unknown>[]> {
  return (await db.execute(write)).rows;
}

/** Whether a failed statement was the database refusing on this constraint or index (a duplicate name, a lost rank, a role someone still holds). */
export function refusedBy(error: unknown, constraint: string): boolean {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  return typeof cause === "object" && cause !== null && "constraint" in cause && cause.constraint === constraint;
}

/** Runs a role write; a duplicate name is the refusal "taken", a lost rank slot or a role someone joined meanwhile is "stale", anything else is thrown. */
export async function runRoleWrite(write: SQL): Promise<{ rows: Record<string, unknown>[] } | RoleRefusal> {
  try {
    return { rows: await rowsOf(write) };
  } catch (error) {
    if (refusedBy(error, "role_definitions_name_unique")) return { status: "taken" };
    if (["role_definitions_rank_unique", "member_role_fk", "invitation_role_fk"].some((c) => refusedBy(error, c))) return { status: "stale" };
    throw error;
  }
}

export const isRefusal = (x: { rows: unknown[] } | RoleRefusal): x is RoleRefusal => "status" in x;

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
