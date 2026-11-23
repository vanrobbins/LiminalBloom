// Companies, regions and who holds which company role (spec 0.7.1, 2 and 3.2). Migration 0021
// adds what drizzle-kit cannot write: `ON DELETE SET NULL (region_id)` on the store profile's
// region key, the insert-only trigger on company_events, and row-level security on every table
// here with no policy and no grant, so the store role reads nothing. Rows are read and written as
// the table owner with the ids filtered by hand, like platform_admins (DECISIONS 11-12).

import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../auth-schema";

import { mapCreatedAt, mapUpdatedAt, mapVersion } from "./columns";

export const companyRole = pgEnum("company_role", ["corporate_admin", "regional_manager"]);
export const companyInvitationStatus = pgEnum("company_invitation_status", ["pending", "accepted", "canceled"]);
export const companyRequestStatus = pgEnum("company_request_status", ["pending", "approved", "rejected", "withdrawn"]);

// Ids are text holding a uuid, like role_definitions (0018); invitation ids are 24 random bytes in base64url, set by the app.
const uuidText = (name: string) => text(name).primaryKey().default(sql`gen_random_uuid()::text`);

/** A company. The owner is a column, not a role_assignments row; one person owns at most one company. */
export const companies = pgTable(
  "companies",
  {
    id: uuidText("id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    // Paused by Liminal Bloom: nobody reaches the company or its stores through it.
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    suspendedByName: text("suspended_by_name"),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    unique("companies_slug_unique").on(t.slug),
    unique("companies_owner_unique").on(t.ownerUserId),
    check("companies_name_length", sql`char_length(${t.name}) between 2 and 60`),
  ],
);

const companyKey = () =>
  text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" });

export const regions = pgTable(
  "regions",
  {
    id: uuidText("id"),
    companyId: companyKey(),
    name: text("name").notNull(),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    // The target of the composite foreign keys below: a region can only be named by its own company.
    unique("regions_company_id_unique").on(t.companyId, t.id),
    uniqueIndex("regions_company_name_unique").on(t.companyId, sql`lower(${t.name})`),
    check("regions_name_length", sql`char_length(${t.name}) between 1 and 40`),
  ],
);

/** A row makes a store part of a company. A store with no row is standalone; the app never deletes a row. */
export const storeProfiles = pgTable(
  "store_profiles",
  {
    storeId: text("store_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    regionId: text("region_id"),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    // Migration 0021 writes this as ON DELETE SET NULL (region_id): a bare SET NULL would also null company_id.
    foreignKey({ name: "store_profiles_region_fk", columns: [t.companyId, t.regionId], foreignColumns: [regions.companyId, regions.id] }).onDelete("set null"),
    index("store_profiles_company_idx").on(t.companyId),
  ],
);

/** A company role other than owner. `user_id` as the primary key is "one company role per person". */
export const roleAssignments = pgTable(
  "role_assignments",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    companyId: companyKey(),
    role: companyRole("role").notNull(),
    regionId: text("region_id"),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
  },
  (t) => [
    // No action: a region that a regional manager holds cannot be deleted.
    foreignKey({ name: "role_assignments_region_fk", columns: [t.companyId, t.regionId], foreignColumns: [regions.companyId, regions.id] }),
    check("role_assignments_role_region", sql`(${t.role} = 'regional_manager') = (${t.regionId} is not null)`),
    index("role_assignments_company_idx").on(t.companyId),
  ],
);

export const companyInvitations = pgTable(
  "company_invitations",
  {
    id: text("id").primaryKey(),
    companyId: companyKey(),
    // Lowercased by the app.
    email: text("email").notNull(),
    role: companyRole("role").notNull(),
    regionId: text("region_id"),
    inviterId: text("inviter_id").references(() => user.id, { onDelete: "set null" }),
    status: companyInvitationStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: mapCreatedAt(),
  },
  (t) => [
    foreignKey({ name: "company_invitations_region_fk", columns: [t.companyId, t.regionId], foreignColumns: [regions.companyId, regions.id] }),
    check("company_invitations_role_region", sql`(${t.role} = 'regional_manager') = (${t.regionId} is not null)`),
    uniqueIndex("company_invitations_pending_unique").on(t.companyId, t.email).where(sql`${t.status} = 'pending'`),
  ],
);

/** A person asking Liminal Bloom for a company of their own (spec 5). */
export const companyRequests = pgTable(
  "company_requests",
  {
    id: uuidText("id"),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    status: companyRequestStatus("status").notNull().default("pending"),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedByName: text("decided_by_name"),
    decisionReason: text("decision_reason"),
    // The company an approval made.
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    uniqueIndex("company_requests_pending_unique").on(t.requesterId).where(sql`${t.status} = 'pending'`),
    check("company_requests_name_length", sql`char_length(${t.companyName}) between 2 and 60`),
  ],
);

/**
 * Insert-only record of what happens in a company, as access_events is for a store. The trigger
 * refuses update, delete and truncate (the owner connection bypasses grants), except the foreign
 * keys' own work: clearing `actor_id` when the actor's account goes, and deleting the rows of a
 * company that has itself been deleted.
 */
export const companyEvents = pgTable(
  "company_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: companyKey(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    event: text("event").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: mapCreatedAt(),
  },
  (t) => [index("company_events_company_idx").on(t.companyId, t.createdAt)],
);

export type Company = typeof companies.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type StoreProfile = typeof storeProfiles.$inferSelect;
export type RoleAssignment = typeof roleAssignments.$inferSelect;
export type CompanyRequest = typeof companyRequests.$inferSelect;
export type CompanyEvent = typeof companyEvents.$inferSelect;
