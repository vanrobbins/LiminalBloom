// The passkeys of an account, for Account and for the "has a second factor" test (spec 0.7.1 8.4, A3c).
// Better Auth's `passkey` table, read as the table owner with the account's id in every query. The public
// key and credential id never leave this file: the list carries only what Account shows. Last used is
// `passkey_last_used` (db/schema/passkey-uses.ts), written when a passkey sign-in is verified.

import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { passkey } from "@/db/auth-schema";
import { passkeyLastUsed } from "@/db/schema";

export type PasskeyRow = { id: string; name: string | null; createdAt: Date | null; lastUsedAt: Date | null };

/** The account's passkeys, oldest first. */
export async function listPasskeys(userId: string): Promise<PasskeyRow[]> {
  return db
    .select({ id: passkey.id, name: passkey.name, createdAt: passkey.createdAt, lastUsedAt: passkeyLastUsed.usedAt })
    .from(passkey)
    .leftJoin(passkeyLastUsed, eq(passkeyLastUsed.passkeyId, passkey.id))
    .where(eq(passkey.userId, userId))
    .orderBy(asc(passkey.createdAt), asc(passkey.id));
}

/** True when the account has at least one passkey. */
export async function hasPasskey(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: passkey.id }).from(passkey).where(eq(passkey.userId, userId)).limit(1);
  return row !== undefined;
}

/** Notes that the passkey with this credential id was just used; an unknown credential is ignored. One statement, so a delete in between cannot break it. */
export async function recordPasskeyUse(credentialId: string): Promise<void> {
  await db.execute(sql`
    insert into passkey_last_used (passkey_id, used_at)
    select ${passkey.id}, now() from ${passkey} where ${passkey.credentialID} = ${credentialId}
    on conflict (passkey_id) do update set used_at = now()
  `);
}
