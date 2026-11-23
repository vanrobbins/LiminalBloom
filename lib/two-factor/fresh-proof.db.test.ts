// An admin who already has a second factor needs a fresh proof of one to change it (review HIGH 1): new
// backup codes, a new authenticator app (start and confirm), a new passkey. Against the development database.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { session } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { allowPasskeyAdd } from "@/lib/passkeys/change";
import { addPasskeyRow } from "@/lib/passkeys/test-passkeys";
import { clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { clearWrongGuesses } from "@/lib/password-guesses";

import { confirmTwoFactor, newBackupCodes, startTwoFactor } from "./setup";
import { accountWithApp, cookieHeader, dropAccounts, makeAccount, TEST_PASSWORD, totpFor } from "./test-accounts";
import { setupKey } from "./totp-key";

afterAll(dropAccounts);

const HOUR = 3_600_000;
const VERIFY = { status: "refused", reason: "verify" };
const setProof = (userId: string, at: Date | null) => db.update(session).set({ twoFactorAt: at }).where(eq(session.userId, userId));
const proofOf = async (userId: string) => (await db.select({ at: session.twoFactorAt }).from(session).where(eq(session.userId, userId)))[0].at;

async function admin() {
  const account = await makeAccount();
  await db.insert(platformAdmins).values({ userId: account.userId, addedByName: "test" });
  return account;
}

describe("new backup codes", () => {
  it("an admin whose session has no fresh second factor is sent to verify, with or without the right password", async () => {
    const a = await accountWithApp({ admin: true });
    await setProof(a.userId, null);
    expect(await newBackupCodes(a.cookie, a.userId, TEST_PASSWORD)).toEqual(VERIFY);
    await setProof(a.userId, new Date(Date.now() - 13 * HOUR));
    expect(await newBackupCodes(a.cookie, a.userId, TEST_PASSWORD)).toEqual(VERIFY);
  });

  it("with a fresh proof the right password gives ten codes", async () => {
    const a = await accountWithApp({ admin: true });
    const reply = await newBackupCodes(a.cookie, a.userId, TEST_PASSWORD);
    expect(reply.status).toBe("codes");
    await clearWrongGuesses(a.userId);
  });

  it("an ordinary account is not asked (no step-up exists for it)", async () => {
    const a = await makeAccount();
    const start = await startTwoFactor(a.cookie, a.userId, TEST_PASSWORD);
    if (start.status !== "started") throw new Error("start refused");
    const done = await confirmTwoFactor(a.cookie, a.userId, await totpFor(setupKey(start.otpauthUri)!));
    if (done.status !== "on") throw new Error("confirm refused");
    await setProof(a.userId, null);
    expect((await newBackupCodes(cookieHeader(done.responseHeaders), a.userId, TEST_PASSWORD)).status).toBe("codes");
    await clearWrongGuesses(a.userId);
  });
});

describe("a passkey-only admin turning the app on", () => {
  it("is refused to start and to confirm without a fresh proof", async () => {
    const a = await admin();
    await addPasskeyRow(a.userId);
    await setProof(a.userId, null);
    expect(await startTwoFactor(a.cookie, a.userId, TEST_PASSWORD)).toEqual(VERIFY);
    await setProof(a.userId, new Date());
    const start = await startTwoFactor(a.cookie, a.userId, TEST_PASSWORD);
    if (start.status !== "started") throw new Error("start refused");
    await setProof(a.userId, new Date(Date.now() - 13 * HOUR));
    expect(await confirmTwoFactor(a.cookie, a.userId, await totpFor(setupKey(start.otpauthUri)!))).toEqual(VERIFY);
    await clearWrongGuesses(a.userId);
  });

  it("the confirm's new session keeps the old proof's time instead of being stamped now", async () => {
    const a = await admin();
    await addPasskeyRow(a.userId);
    const earlier = new Date(Date.now() - 2 * HOUR);
    await setProof(a.userId, earlier);
    const start = await startTwoFactor(a.cookie, a.userId, TEST_PASSWORD);
    if (start.status !== "started") throw new Error("start refused");
    expect((await confirmTwoFactor(a.cookie, a.userId, await totpFor(setupKey(start.otpauthUri)!))).status).toBe("on");
    expect((await proofOf(a.userId))?.getTime()).toBe(earlier.getTime());
    await Promise.all([clearWrongCodes(a.userId), clearWrongGuesses(a.userId)]);
  });

  it("a passkey-only account that is not an admin and never proved anything is not stamped fresh either", async () => {
    const a = await makeAccount();
    await addPasskeyRow(a.userId);
    const start = await startTwoFactor(a.cookie, a.userId, TEST_PASSWORD);
    if (start.status !== "started") throw new Error("start refused");
    expect((await confirmTwoFactor(a.cookie, a.userId, await totpFor(setupKey(start.otpauthUri)!))).status).toBe("on");
    expect(await proofOf(a.userId)).toBeNull();
    await Promise.all([clearWrongCodes(a.userId), clearWrongGuesses(a.userId)]);
  });

  it("an admin with no second factor yet can still start (it is how they get one)", async () => {
    const a = await admin();
    expect((await startTwoFactor(a.cookie, a.userId, TEST_PASSWORD)).status).toBe("started");
    await clearWrongGuesses(a.userId);
  });
});

describe("adding a passkey", () => {
  it("an admin with the app on, or a passkey, and no fresh proof is sent to verify before any code or password is looked at", async () => {
    const withApp = await accountWithApp({ admin: true });
    await setProof(withApp.userId, null);
    expect(await allowPasskeyAdd(withApp.cookie, withApp.userId, TEST_PASSWORD)).toEqual(VERIFY);
    const withKey = await admin();
    await addPasskeyRow(withKey.userId);
    expect(await allowPasskeyAdd(withKey.cookie, withKey.userId, TEST_PASSWORD)).toEqual(VERIFY);
  });

  it("an admin with no second factor yet, or an ordinary account, gets to the password check", async () => {
    const first = await admin();
    expect(await allowPasskeyAdd(first.cookie, first.userId, "not-the-password-1")).toEqual({ status: "refused", reason: "password" });
    const plain = await makeAccount();
    await addPasskeyRow(plain.userId);
    expect(await allowPasskeyAdd(plain.cookie, plain.userId, "not-the-password-1")).toEqual({ status: "refused", reason: "password" });
    await Promise.all([clearWrongGuesses(first.userId), clearWrongGuesses(plain.userId)]);
  });
});
