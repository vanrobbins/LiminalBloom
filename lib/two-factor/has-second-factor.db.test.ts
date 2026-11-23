// "Has a second factor" and the Account status, against the development database: true only once the
// authenticator was confirmed with a code (a started setup is not it), read from the account and not from the
// session (DECISIONS 11-23), and the backup codes left.

import { afterAll, describe, expect, it } from "vitest";

import { member } from "@/db/auth-schema";
import { db } from "@/db";
import { dropPeople, makeStoreWithRoles } from "@/lib/access/test-roles";
import { dropStores } from "@/lib/products/test-stores";
import { clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { clearWrongGuesses } from "@/lib/password-guesses";

import { addPasskeyRow } from "@/lib/passkeys/test-passkeys";

import { hasAuthenticatorApp, hasSecondFactor } from "./has-second-factor";
import { confirmTwoFactor, newBackupCodes, startTwoFactor } from "./setup";
import { twoFactorStatus } from "./status";
import { cookieHeader, dropAccounts, makeAccount, TEST_PASSWORD, totpFor } from "./test-accounts";
import { storeRequiringTwoFactor } from "./required-by";
import { setupKey } from "./totp-key";

afterAll(async () => {
  await dropAccounts();
  await dropStores();
  await dropPeople();
});

describe("hasSecondFactor and twoFactorStatus", () => {
  it("is false for a new account, false after only starting setup, true once a code confirms it", async () => {
    const account = await makeAccount();
    expect(await hasSecondFactor(account.userId)).toBe(false);
    expect(await twoFactorStatus(account.userId)).toEqual({ on: false, codesLeft: 0, isAdmin: false, requiredBy: null, passkeys: [] });

    const start = await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD);
    if (start.status !== "started") throw new Error("start refused");
    expect(await hasSecondFactor(account.userId)).toBe(false);

    const done = await confirmTwoFactor(account.cookie, account.userId, await totpFor(setupKey(start.otpauthUri)!));
    expect(done.status).toBe("on");
    expect(await hasSecondFactor(account.userId)).toBe(true);
    expect(await twoFactorStatus(account.userId)).toEqual({ on: true, codesLeft: 10, isAdmin: false, requiredBy: null, passkeys: [] });
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

  it("a passkey is a second factor on its own: no authenticator app, yet the account has two-factor (A3c)", async () => {
    const account = await makeAccount();
    expect(await hasSecondFactor(account.userId)).toBe(false);
    await addPasskeyRow(account.userId, "Phone");
    expect(await hasAuthenticatorApp(account.userId)).toBe(false);
    expect(await hasSecondFactor(account.userId)).toBe(true);
    // Account shows the app as off and lists the passkey beside it.
    expect(await twoFactorStatus(account.userId)).toMatchObject({ on: false, codesLeft: 0, passkeys: [{ name: "Phone", lastUsedAt: null }] });
  });

  it("a role that requires two-factor is met by a passkey: the check getCurrentMember makes passes once one exists (A3c)", async () => {
    const account = await makeAccount();
    const { store, roles } = await makeStoreWithRoles("role-met-by-passkey");
    await db.insert(member).values({ id: `m-${account.userId}`, organizationId: store, userId: account.userId, role: "member", roleId: roles.store_manager, createdAt: new Date() });
    expect(await storeRequiringTwoFactor(account.userId)).toContain("role-met-by-passkey");
    expect(await hasSecondFactor(account.userId)).toBe(false);
    await addPasskeyRow(account.userId);
    expect(await hasSecondFactor(account.userId)).toBe(true);
  });
});
