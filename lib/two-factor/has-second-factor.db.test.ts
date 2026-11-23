// "Has a second factor" and the Account status, against the development database: true only once the
// authenticator was confirmed with a code (a started setup is not it), read from the account and not from the
// session (DECISIONS 11-23), and the backup codes left.

import { afterAll, describe, expect, it } from "vitest";

import { clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { clearWrongGuesses } from "@/lib/password-guesses";

import { hasSecondFactor } from "./has-second-factor";
import { confirmTwoFactor, newBackupCodes, startTwoFactor } from "./setup";
import { twoFactorStatus } from "./status";
import { cookieHeader, dropAccounts, makeAccount, TEST_PASSWORD, totpFor } from "./test-accounts";
import { setupKey } from "./totp-key";

afterAll(dropAccounts);

describe("hasSecondFactor and twoFactorStatus", () => {
  it("is false for a new account, false after only starting setup, true once a code confirms it", async () => {
    const account = await makeAccount();
    expect(await hasSecondFactor(account.userId)).toBe(false);
    expect(await twoFactorStatus(account.userId)).toEqual({ on: false, codesLeft: 0, isAdmin: false, requiredBy: null });

    const start = await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD);
    if (start.status !== "started") throw new Error("start refused");
    expect(await hasSecondFactor(account.userId)).toBe(false);

    const done = await confirmTwoFactor(account.cookie, account.userId, await totpFor(setupKey(start.otpauthUri)!));
    expect(done.status).toBe("on");
    expect(await hasSecondFactor(account.userId)).toBe(true);
    expect(await twoFactorStatus(account.userId)).toEqual({ on: true, codesLeft: 10, isAdmin: false, requiredBy: null });
    await Promise.all([clearWrongCodes(account.userId), clearWrongGuesses(account.userId)]);
  });

  it("counts the backup codes left: new ones are ten again", async () => {
    const account = await makeAccount();
    const start = await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD);
    if (start.status !== "started") throw new Error("start refused");
    const done = await confirmTwoFactor(account.cookie, account.userId, await totpFor(setupKey(start.otpauthUri)!));
    if (done.status !== "on") throw new Error("confirm refused");
    expect((await twoFactorStatus(account.userId)).codesLeft).toBe(10);
    // New codes need the session cookie the confirm made, not the old one.
    const fresh = cookieHeader(done.responseHeaders);
    expect((await newBackupCodes(fresh, account.userId, TEST_PASSWORD)).status).toBe("codes");
    expect((await twoFactorStatus(account.userId)).codesLeft).toBe(10);
    await clearWrongGuesses(account.userId);
  });
});
