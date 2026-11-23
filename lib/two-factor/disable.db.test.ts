// Turning two-factor off, against the development database (spec 0.7.1 8.3, A3b; A0 8.4): the password and a
// current code are both needed, each wrong try is counted, the swapped session's cookie comes back, a Liminal
// Bloom admin is refused.

import { eq } from "drizzle-orm";
import { member } from "@/db/auth-schema";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { twoFactor, user, verification } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { dropPeople, makeStoreWithRoles } from "@/lib/access/test-roles";
import { auth } from "@/lib/auth";
import { clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { clearWrongGuesses } from "@/lib/password-guesses";
import { dropStores } from "@/lib/products/test-stores";

import { disableTwoFactor } from "./disable";
import { confirmTwoFactor, startTwoFactor } from "./setup";
import { cookieHeader, dropAccounts, makeAccount, TEST_PASSWORD, totpFor } from "./test-accounts";
import { setupKey } from "./totp-key";

afterAll(async () => {
  await dropAccounts();
  await dropStores();
  await dropPeople();
});

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

  it("refuses, naming the store, when the person's role requires two-factor; it stays on", async () => {
    const a = await accountWithTwoFactor();
    const { store, roles } = await makeStoreWithRoles("disable-required");
    await db.insert(member).values({ id: `m-${a.userId}`, organizationId: store, userId: a.userId, role: "member", roleId: roles.store_manager, createdAt: new Date() });
    const reply = await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, await totpFor(a.key));
    expect(reply).toMatchObject({ status: "refused", reason: "required", store: expect.stringContaining("disable-required") });
    expect(await isOn(a.userId)).toBe(true);
    // A role that does not require it leaves Turn off open.
    await db.update(member).set({ roleId: roles.vm_worker }).where(eq(member.userId, a.userId));
    expect((await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, await totpFor(a.key))).status).toBe("off");
  });

  it("forgets every trusted device of the account, this one and the others, and no one else's", async () => {
    const a = await accountWithTwoFactor();
    const b = await makeAccount();
    const row = (identifier: string, value: string) => ({ id: identifier, identifier, value, expiresAt: new Date(Date.now() + 3_600_000) });
    await db.insert(verification).values([row(`trust-device-${a.userId}-1`, a.userId), row(`trust-device-${a.userId}-2`, a.userId), row(`trust-device-${b.userId}-1`, b.userId)]);
    expect((await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, await totpFor(a.key))).status).toBe("off");
    expect(await db.select().from(verification).where(eq(verification.value, a.userId))).toHaveLength(0);
    expect(await db.select().from(verification).where(eq(verification.value, b.userId))).toHaveLength(1);
  });

  it("a right code clears the code counter even when the password is wrong, so it never burns tries", async () => {
    const a = await accountWithTwoFactor();
    for (let i = 0; i < 4; i++) await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, "000000");
    expect(await disableTwoFactor(a.cookie, a.userId, "not-the-password-1", await totpFor(a.key))).toEqual({ status: "refused", reason: "password" });
    // Four wrong tries and a right-code try would have been five: the counter starts over, so four more wrong ones are still allowed.
    for (let i = 0; i < 4; i++) expect(await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, "000000")).toEqual({ status: "refused", reason: "code" });
    await Promise.all([clearWrongCodes(a.userId), clearWrongGuesses(a.userId)]);
  });
});
