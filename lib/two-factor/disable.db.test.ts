// Turning two-factor off, against the development database (spec 0.7.1 8.3, A3b; A0 8.4): the password and a
// current code are both needed, each wrong try is counted, the swapped session's cookie comes back, a Liminal
// Bloom admin is refused.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { twoFactor, user } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { auth } from "@/lib/auth";
import { clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { clearWrongGuesses } from "@/lib/password-guesses";

import { disableTwoFactor } from "./disable";
import { confirmTwoFactor, startTwoFactor } from "./setup";
import { cookieHeader, dropAccounts, makeAccount, TEST_PASSWORD, totpFor } from "./test-accounts";
import { setupKey } from "./totp-key";

afterAll(dropAccounts);

/** An account with two-factor on: its id, the key and the cookie of the session the confirm made. */
async function accountWithTwoFactor() {
  const account = await makeAccount();
  const start = await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD);
  if (start.status !== "started") throw new Error("start refused");
  const key = setupKey(start.otpauthUri)!;
  const done = await confirmTwoFactor(account.cookie, account.userId, await totpFor(key));
  if (done.status !== "on") throw new Error("confirm refused");
  await Promise.all([clearWrongCodes(account.userId), clearWrongGuesses(account.userId)]);
  return { ...account, key, cookie: cookieHeader(done.responseHeaders) };
}

const isOn = async (userId: string) => (await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId)))[0].on;
const factorRows = async (userId: string) => (await db.select().from(twoFactor).where(eq(twoFactor.userId, userId))).length;

describe("disableTwoFactor", () => {
  it("turns it off with the right password and a current code, and hands back the new session's cookie", async () => {
    const a = await accountWithTwoFactor();
    const reply = await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, await totpFor(a.key));
    expect(reply.status).toBe("off");
    if (reply.status !== "off") return;
    expect(await isOn(a.userId)).toBe(false);
    expect(await factorRows(a.userId)).toBe(0);
    // The old session was replaced: its cookie no longer works, the new one does.
    expect(await auth.api.getSession({ headers: a.cookie })).toBeNull();
    expect(await auth.api.getSession({ headers: cookieHeader(reply.responseHeaders) })).not.toBeNull();
  });

  it("a wrong code is refused and leaves it on; the right password alone is not enough", async () => {
    const a = await accountWithTwoFactor();
    expect(await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, "000000")).toEqual({ status: "refused", reason: "code" });
    expect(await isOn(a.userId)).toBe(true);
    await clearWrongCodes(a.userId);
  });

  it("a wrong password is refused, spends no code try beyond its own, and leaves it on", async () => {
    const a = await accountWithTwoFactor();
    expect(await disableTwoFactor(a.cookie, a.userId, "not-the-password-1", await totpFor(a.key))).toEqual({ status: "refused", reason: "password" });
    expect(await isOn(a.userId)).toBe(true);
    await Promise.all([clearWrongCodes(a.userId), clearWrongGuesses(a.userId)]);
  });

  it("five wrong codes lock the next try, even a right one", async () => {
    const a = await accountWithTwoFactor();
    for (let i = 0; i < 5; i++) await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, "000000");
    expect(await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, await totpFor(a.key))).toEqual({ status: "refused", reason: "locked" });
    expect(await isOn(a.userId)).toBe(true);
    await clearWrongCodes(a.userId);
  });

  it("refuses a Liminal Bloom admin before anything is checked", async () => {
    const a = await accountWithTwoFactor();
    await db.insert(platformAdmins).values({ userId: a.userId, addedByName: "Test" });
    expect(await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, await totpFor(a.key))).toEqual({ status: "refused", reason: "admin" });
    expect(await isOn(a.userId)).toBe(true);
    await db.delete(platformAdmins).where(eq(platformAdmins.userId, a.userId));
  });

  it("an account that has it off is refused (nothing to turn off)", async () => {
    const account = await makeAccount();
    const reply = await disableTwoFactor(account.cookie, account.userId, TEST_PASSWORD, "123456");
    expect(reply.status).toBe("refused");
    await clearWrongCodes(account.userId);
  });
});
