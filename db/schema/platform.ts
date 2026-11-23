// Liminal Bloom's own admins and the help desk (spec 0.7.1, 3.1 and 7). Migration 0020 adds
// what drizzle-kit cannot write: the insert-only trigger on platform_events and row-level
// security on every table here, with no policy and no grant, so the store role reads nothing.
// Rows are read and written as the table owner with the ids filtered by hand, like
// access_events (DECISIONS 11-12).

import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../auth-schema";

import { mapCreatedAt, mapUpdatedAt, mapVersion } from "./columns";
import { companyRequests } from "./companies";

// `company_request` is here from 0.7.1a so 0.7.1b adds no enum value.
export const helpKind = pgEnum("help_kind", ["account", "company_request", "broken", "other"]);
export const helpStatus = pgEnum("help_status", ["open", "answered", "closed"]);

/** A Liminal Bloom admin: an ordinary account, outside every store and company. */
export const platformAdmins = pgTable("platform_admins", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
  addedByName: text("added_by_name").notNull(),
  createdAt: mapCreatedAt(),
});

/**
 * Insert-only record of what admins do. The trigger refuses update and delete (the owner
 * connection bypasses grants), except the foreign key clearing `actor_id` when the actor's
 * account is deleted. `target_id` and `company_id` have no foreign key: the record outlives them.
 */
export const platformEvents = pgTable(
  "platform_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    // user, store, invitation, company, company_request, admin or help_request.
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    targetLabel: text("target_label").notNull(),
    companyId: text("company_id"),
    reason: text("reason").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: mapCreatedAt(),
  },
  (t) => [index("platform_events_created_idx").on(t.createdAt), index("platform_events_company_idx").on(t.companyId, t.createdAt)],
);

/** A row means the store is paused; restoring deletes it (the event stays in platform_events). */
export const storeSuspensions = pgTable("store_suspensions", {
  storeId: text("store_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  suspendedBy: text("suspended_by").references(() => user.id, { onDelete: "set null" }),
  suspendedByName: text("suspended_by_name").notNull(),
  createdAt: mapCreatedAt(),
});

export const helpRequests = pgTable(
  "help_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: helpKind("kind").notNull(),
    status: helpStatus("status").notNull().default("open"),
    // Written by the server (spec 9.2), never from a form.
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    // The company request a `company_request` thread is about (spec 0.7.1b, 9); the link clears if the request goes.
    companyRequestId: text("company_request_id").references(() => companyRequests.id, { onDelete: "set null" }),
    requesterSeenAt: timestamp("requester_seen_at", { withTimezone: true }),
    adminSeenAt: timestamp("admin_seen_at", { withTimezone: true }),
    // `requester` or `admin`; set exactly when the request is closed.
    closedBy: text("closed_by"),
    version: mapVersion(),
    createdAt: mapCreatedAt(),
    updatedAt: mapUpdatedAt(),
  },
  (t) => [
    index("help_requests_requester_idx").on(t.requesterId, t.status),
    index("help_requests_status_idx").on(t.status, t.updatedAt),
    // One open thread per company request.
    uniqueIndex("help_requests_company_request_open_unique").on(t.companyRequestId).where(sql`${t.status} <> 'closed'`),
    check("help_requests_closed_by_check", sql`(${t.closedBy} is not null) = (${t.status} = 'closed')`),
    check("help_requests_closed_by_known", sql`${t.closedBy} is null or ${t.closedBy} in ('requester', 'admin')`),
  ],
);

export const helpMessages = pgTable(
  "help_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => helpRequests.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    fromAdmin: boolean("from_admin").notNull().default(false),
    body: text("body").notNull(),
    createdAt: mapCreatedAt(),
  },
  (t) => [
    index("help_messages_request_idx").on(t.requestId, t.createdAt),
    check("help_messages_body_length", sql`char_length(${t.body}) between 1 and 2000`),
  ],
);

export type HelpRequest = typeof helpRequests.$inferSelect;
export type HelpMessage = typeof helpMessages.$inferSelect;
export type PlatformEvent = typeof platformEvents.$inferSelect;
