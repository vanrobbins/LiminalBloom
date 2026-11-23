// When each passkey last signed anyone in or confirmed a step-up (spec 0.7.1 8.4, A3c). Better Auth's
// own `passkey` table has no such column and its plugin cannot be given one, so it is kept here: one
// row per passkey, written by lib/passkeys/last-used.ts after a passkey sign-in is verified and gone
// with the passkey. Row-level security on, no policy, no grant: read and written as the table owner,
// like platform_admins.

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { passkey } from "../auth-schema";

export const passkeyLastUsed = pgTable("passkey_last_used", {
  passkeyId: text("passkey_id")
    .primaryKey()
    .references(() => passkey.id, { onDelete: "cascade" }),
  usedAt: timestamp("used_at", { withTimezone: true }).defaultNow().notNull(),
});
