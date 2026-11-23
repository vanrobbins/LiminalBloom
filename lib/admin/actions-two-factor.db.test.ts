// "Reset two-factor" for an ordinary account (spec 0.7.1 7.4, deferred from A3b) against the dev database:
// the authenticator app, backup codes, passkeys, trusted devices and sessions go, in one batch with the event;
// a Liminal Bloom admin is refused (admins stay script-only, spec 7.1).

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { passkey, session, twoFactor, user, verification } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { makePerson, makeStoreWithRoles } from "@/lib/access/test-roles";
import { addPasskeyRow } from "@/lib/passkeys/test-passkeys";

import { resetAccountTwoFactor } from "./actions-two-factor";
import { cleanUp, eventsFor, makeActor } from "@/lib/access/test-admin-actions";

const REASON = "db test: reset two-factor";
afterAll(() => cleanUp([REASON]));

/** An ordinary account with everything two-factor can leave behind. */
async function accountWithTwoFactor() {
  const { userId } = await makePerson((await makeStoreWithRoles("tf")).store, null);
  await db.insert(twoFactor).values({ id: randomUUID(), secret: "secret", backupCodes: "codes", userId });
  await addPasskeyRow(userId);
  await db.insert(session).values({ id: randomUUID(), token: randomUUID(), userId, expiresAt: new Date(Date.now() + 3_600_000) });
  const later = new Date(Date.now() + 3_600_000);
  await db.insert(verification).values([
    { id: randomUUID(), identifier: `trust-device-${randomUUID()}`, value: userId, expiresAt: later },
    { id: `two-factor-failures:${userId}`, identifier: `two-factor-failures:${userId}`, value: "3", expiresAt: later },
  ]);
  return userId;
}
const left = async (userId: string) => ({
  app: (await db.select().from(twoFactor).where(eq(twoFactor.userId, userId))).length,
  passkeys: (await db.select().from(passkey).where(eq(passkey.userId, userId))).length,
  sessions: (await db.select().from(session).where(eq(session.userId, userId))).length,
  records: (await db.select().from(verification).where(eq(verification.value, userId))).length + (await db.select().from(verification).where(eq(verification.id, `two-factor-failures:${userId}`))).length,
  on: (await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId)))[0].on,
});

describe("resetAccountTwoFactor", () => {
  it("removes the app, backup codes, passkeys, trusted devices and wrong-code count, signs the account out and writes the event", async () => {
    const actor = await makeActor();
    const userId = await accountWithTwoFactor();
    expect(await resetAccountTwoFactor(actor, userId, REASON)).toEqual({ status: "done" });
    expect(await left(userId)).toEqual({ app: 0, passkeys: 0, sessions: 0, records: 0, on: false });
    expect(await eventsFor(userId)).toEqual([expect.objectContaining({ action: "two_factor_reset", targetKind: "user", actorId: actor.userId, reason: REASON })]);
  });

  it("refuses a Liminal Bloom admin and leaves everything of theirs alone", async () => {
    const userId = await accountWithTwoFactor();
    await db.insert(platformAdmins).values({ userId, addedByName: "test" });
    expect(await resetAccountTwoFactor(await makeActor(), userId, REASON)).toEqual({ status: "admin" });
    expect(await left(userId)).toEqual({ app: 1, passkeys: 1, sessions: 1, records: 2, on: true });
    expect(await eventsFor(userId)).toHaveLength(0);
  });

  it("holds against an admin row that appears after the check: the writes themselves are guarded", async () => {
    const userId = await accountWithTwoFactor();
    await db.insert(platformAdmins).values({ userId, addedByName: "test" });
    const { applyReset } = await import("./actions-two-factor");
    expect(await applyReset(await makeActor(), { id: userId, email: "x@example.com" }, REASON)).toEqual({ status: "admin" });
    expect(await left(userId)).toEqual({ app: 1, passkeys: 1, sessions: 1, records: 2, on: true });
  });

  it("says not-on for an account with no two-factor and gone for no account, writing nothing", async () => {
    const { userId } = await makePerson((await makeStoreWithRoles("tf2")).store, null);
    await db.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, userId));
    const actor = await makeActor();
    expect(await resetAccountTwoFactor(actor, userId, REASON)).toEqual({ status: "not-on" });
    expect(await resetAccountTwoFactor(actor, randomUUID(), REASON)).toEqual({ status: "gone" });
    expect(await eventsFor(userId)).toHaveLength(0);
  });

  it("is all or nothing: an event that cannot be written leaves the two-factor alone", async () => {
    const userId = await accountWithTwoFactor();
    await expect(resetAccountTwoFactor({ userId: randomUUID(), name: "Nobody" }, userId, REASON)).rejects.toThrow();
    expect(await left(userId)).toEqual({ app: 1, passkeys: 1, sessions: 1, records: 2, on: true });
  });
});
