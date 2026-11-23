// Two writes can each leave an account that needs two-factor with none: removing its last passkey while the
// app is being turned off, and turning the app off while its last passkey is being removed. Each looks first
// and writes after, so both can see "the other one remains" and both write. Better Auth's turn-off is not a
// statement we own, so the pair is serialised through a mark instead: turning the app off first claims
// `turning-off-<user>` in one transaction with a per-account lock, and only while a passkey is there; removing
// a passkey takes the same lock and refuses to count the app as "remaining" while the mark is live.
// Whichever takes the lock first wins, and the other sees its effect.

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

const identifier = (userId: string) => `turning-off-${userId}`;
// `verification.expires_at` is a UTC timestamp without a zone.
const utcNow = sql`(now() at time zone 'utc')`;

/** The statement that takes the account's factor lock until its transaction ends: the first item of a `db.batch`. */
export const factorLock = (userId: string) => db.execute(sql`select pg_advisory_xact_lock(hashtext(${"factors:" + userId}))`);

/** The statement text for "the app is being turned off right now" (two minutes at most, so a crash frees it). */
export const turningOff = (userId: string) => sql`exists (select 1 from verification where identifier = ${identifier(userId)} and expires_at > ${utcNow})`;

/** True when a passkey is there and the turn-off now holds the mark. False: the passkey went first, so the app must stay. */
export async function claimTurnOff(userId: string): Promise<boolean> {
  const [, claimed] = await db.batch([
    factorLock(userId),
    db.execute(sql`
      insert into verification (id, identifier, value, expires_at)
      select ${identifier(userId)}, ${identifier(userId)}, ${userId}, ${utcNow} + interval '2 minutes'
      where exists (select 1 from passkey where user_id = ${userId})
      on conflict (id) do update set expires_at = excluded.expires_at
      returning id
    `),
  ]);
  return claimed.rows.length === 1;
}

export async function releaseTurnOff(userId: string): Promise<void> {
  await db.execute(sql`delete from verification where id = ${identifier(userId)}`);
}
