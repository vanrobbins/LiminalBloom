// Roles a store defines for its people, and the log of changes to them (spec
// 0.7, 4.4 and the spike findings under 4.5). Migration 0018 adds what drizzle-kit
// cannot write: the foreign keys from Better Auth's member and invitation, the
// deferrable rank constraint, grants, row-level security and the backfill.

import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

import { mapCreatedAt, mapStoreId, mapUpdatedAt, mapVersion } from "./columns";

export const roleDefinitions = pgTable(
  "role_definitions",
  {
    // Text holding a uuid, because Better Auth's member.role_id is text and
    // must reference it.
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    storeId: mapStoreId(),
    // Null for a custom role; otherwise which built-in this row is (lib/access/roles.ts).
    builtin: text("builtin"),
    name: text("name").notNull(),
    // Smaller is higher. Built-ins sit at 100 to 500 so custom roles fit between.
    rank: integer("rank").notNull(),
    switches: text("switches").array().notNull(),
    // Whoever holds this role must have two-factor sign-in (0.7.1a, A3b). Migration 0020 turns it
    // on for roles holding people.manage or roles.manage, and a new role gets the same default.
    requiresTwoFactor: boolean("requires_two_factor").notNull().default(false),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    // The target of the composite foreign keys on member and invitation.
    uniqueIndex("role_definitions_store_id_unique").on(t.storeId, t.id),
    uniqueIndex("role_definitions_name_unique").on(t.storeId, sql`lower(${t.name})`),
    unique("role_definitions_builtin_unique").on(t.storeId, t.builtin),
    // A constraint, not an index, so migration 0018 can make it DEFERRABLE
    // INITIALLY IMMEDIATE: a deferrable unique constraint is checked at the end
    // of the statement, so renumbering ranks in ONE statement passes through
    // duplicates without a SET CONSTRAINTS batch (lib/access/roles-structure.ts).
    unique("role_definitions_rank_unique").on(t.storeId, t.rank),
    check("role_definitions_rank_positive", sql`${t.rank} > 0`),
    check(
      "role_definitions_builtin_known",
      sql`${t.builtin} is null or ${t.builtin} in ('store_manager', 'assistant_manager', 'vm_manager', 'vm_worker', 'sales_associate')`,
    ),
  ],
);

/**
 * Insert-only record of role and people changes (outline 3.10 item 8). The
 * actor's name is copied in because the store role cannot read `user`.
 */
export const accessEvents = pgTable(
  "access_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: mapStoreId(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    event: text("event").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: mapCreatedAt(),
  },
  (t) => [index("access_events_store_idx").on(t.storeId, t.createdAt)],
);

export type RoleDefinition = typeof roleDefinitions.$inferSelect;
