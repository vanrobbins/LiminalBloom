// The one advisory-lock key for a request's replies and close, shared by the requester's writes (write.ts) and the
// admin's (lib/admin/actions-help.ts), so the 50-message cap and a close hold across both sides.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/** A batch's first statement: waits for any other writer of this request to finish, until the batch commits. */
export const replyLock = (id: string) => db.execute(sql`select pg_advisory_xact_lock(hashtext(${"reply:" + id}))`);
