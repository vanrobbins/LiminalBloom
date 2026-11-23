// The admin script's two jobs against the development database: grant, and reset two-factor.

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { session, twoFactor, user } from "@/db/auth-schema";
import { platformAdmins, platformEvents } from "@/db/schema";
import { listPasskeys } from "@/lib/passkeys/list";
import { addPasskeyRow } from "@/lib/passkeys/test-passkeys";
import { confirmTwoFactor, startTwoFactor } from "@/lib/two-factor/setup";
import { dropAccounts, makeAccount, TEST_PASSWORD, totpFor } from "@/lib/two-factor/test-accounts";
import { setupKey } from "@/lib/two-factor/totp-key";

import { grantAdmin, resetTwoFactor } from "./platform-admin-run";

const targets: string[] = [];
afterAll(async () => {
  // platform_events is insert-only, so a test's rows are removed with its triggers off, in one transaction.
  if (targets.length) {
    await db.batch([
      db.execute(sql`alter table platform_events disable trigger user`),
      db.delete(platformEvents).where(inArray(platformEvents.targetId, targets)),
      db.execute(sql`alter table platform_events enable trigger user`),
    ]);
  }
  await dropAccounts();
});

const account = async () => {
  const a = await makeAccount();
  targets.push(a.userId);
  return a;
};
const eventsFor = (userId: string) => db.select().from(platformEvents).where(eq(platformEvents.targetId, userId));

describe("grantAdmin", () => {
  it("makes the account an admin and logs it, matching the email in any case", async () => {
    const a = await account();
    expect(await grantAdmin(a.email.toUpperCase())).toEqual({ status: "granted", userId: a.userId });
    expect(await db.select().from(platformAdmins).where(eq(platformAdmins.userId, a.userId))).toHaveLength(1);
    expect(await eventsFor(a.userId)).toEqual([expect.objectContaining({ action: "admin_added", actorName: "Liminal Bloom script", actorId: null })]);
  });

  it("says so for an account that already is one, and adds nothing", async () => {
    const a = await account();
    await grantAdmin(a.email);
    expect(await grantAdmin(a.email)).toEqual({ status: "already", userId: a.userId });
    expect(await eventsFor(a.userId)).toHaveLength(1);
  });

  it("refuses an email with no account, naming it", async () => {
    await expect(grantAdmin("nobody-here@example.com")).rejects.toThrow(/No account for nobody-here@example\.com/);
  });
});

describe("resetTwoFactor", () => {
  async function adminWithTwoFactor() {
    const a = await account();
    await grantAdmin(a.email);
    const start = await startTwoFactor(a.cookie, a.userId, TEST_PASSWORD);
    if (start.status !== "started") throw new Error("start refused");
    const on = await confirmTwoFactor(a.cookie, a.userId, await totpFor(setupKey(start.otpauthUri)!));
    if (on.status !== "on") throw new Error("confirm refused");
    return a;
  }

  it("turns two-factor off, forgets the secret, signs the admin out everywhere and logs it", async () => {
    const a = await adminWithTwoFactor();
    expect(await resetTwoFactor(a.email)).toEqual({ status: "reset", userId: a.userId });
    expect(await db.select().from(twoFactor).where(eq(twoFactor.userId, a.userId))).toHaveLength(0);
    expect((await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, a.userId)))[0].on).toBe(false);
    expect(await db.select().from(session).where(eq(session.userId, a.userId))).toHaveLength(0);
    expect((await eventsFor(a.userId)).map((e) => e.action)).toContain("two_factor_reset");
    // Still an admin: they sign in with the password and set it up again.
    expect(await db.select().from(platformAdmins).where(eq(platformAdmins.userId, a.userId))).toHaveLength(1);
  });

  it("forgets the admin's passkeys too, so a lost device cannot still sign in", async () => {
    const a = await account();
    await grantAdmin(a.email);
    await addPasskeyRow(a.userId, "Lost phone");
    await addPasskeyRow(a.userId, "Lost laptop");
    expect(await listPasskeys(a.userId)).toHaveLength(2);
    await resetTwoFactor(a.email);
    expect(await listPasskeys(a.userId)).toHaveLength(0);
  });

  it("refuses an account that is not an admin (ordinary accounts are reset from the admin area, not here)", async () => {
    const a = await account();
    await expect(resetTwoFactor(a.email)).rejects.toThrow(/is not a Liminal Bloom admin/);
  });

  it("refuses an email with no account", async () => {
    await expect(resetTwoFactor("nobody-here@example.com")).rejects.toThrow(/No account for/);
  });

  it("also forgets the step-up's wrong-code count", async () => {
    const a = await adminWithTwoFactor();
    await db.execute(sql`insert into verification (id, identifier, value, expires_at) values (${`two-factor-failures:${a.userId}`}, ${`two-factor-failures:${a.userId}`}, '5', now() + interval '10 minutes')`);
    await resetTwoFactor(a.email);
    expect(await db.execute(sql`select 1 from verification where identifier like ${`two-factor-failures:${a.userId}`}`)).toHaveProperty("rowCount", 0);
  });
});
