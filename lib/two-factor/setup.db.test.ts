// Turning two-factor on through Better Auth's server calls, against the development database
// (spec 0.7.1 8.3, A0 findings 2): start with the password, confirm with a code, and what the
// confirm must leave behind: the new session carrying `two_factor_at`, every other session gone,
// the short session kept short. A wrong password is counted, and five stop the next try.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { session, twoFactor, user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { clearWrongGuesses } from "@/lib/password-guesses";

import { confirmTwoFactor, newBackupCodes, startTwoFactor } from "./setup";
import { cookieHeader, dropAccounts, makeAccount, signInAgain, TEST_PASSWORD, totpFor } from "./test-accounts";
import { setupKey } from "./totp-key";

afterAll(dropAccounts);

const HOUR = 3_600_000;
const signedIn = async (cookie: Headers) => (await auth.api.getSession({ headers: cookie })) !== null;
const twoFactorRow = async (userId: string) => (await db.select().from(twoFactor).where(eq(twoFactor.userId, userId)))[0];

/** An account that has started setup: its id, cookie and the setup key. */
async function started() {
  const account = await makeAccount();
  const reply = await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD);
  if (reply.status !== "started") throw new Error(`start refused: ${reply.reason}`);
  return { ...account, key: setupKey(reply.otpauthUri)!, reply };
}

describe("startTwoFactor", () => {
  it("returns the otpauth link, its setup key and ten backup codes, and leaves two-factor off (unverified secret)", async () => {
    const { userId, reply, key } = await started();
    expect(reply.status).toBe("started");
    if (reply.status !== "started") return;
    expect(reply.otpauthUri).toMatch(/^otpauth:\/\/totp\/Liminal%20Bloom:/);
    expect(reply.setupKey).toBe(key);
    expect(reply.backupCodes).toHaveLength(10);
    expect(reply.qrSvg).toContain("<svg");
    expect((await twoFactorRow(userId)).verified).toBe(false);
    expect((await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId)))[0].on).toBe(false);
  });

  it("a wrong password is refused, starts nothing, and a right one afterwards still works", async () => {
    const account = await makeAccount();
    expect(await startTwoFactor(account.cookie, account.userId, "not-it-at-all")).toEqual({ status: "refused", reason: "password" });
    expect(await twoFactorRow(account.userId)).toBeUndefined();
    expect((await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD)).status).toBe("started");
    await clearWrongGuesses(account.userId);
  });

  it("five wrong passwords lock the next try, even the right password, without asking Better Auth", async () => {
    const account = await makeAccount();
    for (let i = 0; i < 5; i++) await startTwoFactor(account.cookie, account.userId, "wrong-wrong-1");
    expect(await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD)).toEqual({ status: "refused", reason: "locked" });
    expect(await twoFactorRow(account.userId)).toBeUndefined();
    await clearWrongGuesses(account.userId);
  });
});

describe("confirmTwoFactor", () => {
  it("a wrong code is refused and two-factor stays off", async () => {
    const { cookie, userId } = await started();
    expect(await confirmTwoFactor(cookie, userId, "000000")).toEqual({ status: "refused", reason: "code" });
    expect((await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId)))[0].on).toBe(false);
  });

  it("five wrong codes lock the next try, even the right code, without asking Better Auth, and leave two-factor off", async () => {
    const { cookie, userId, key } = await started();
    for (let i = 0; i < 5; i++) expect(await confirmTwoFactor(cookie, userId, "000000")).toEqual({ status: "refused", reason: "code" });
    const verifier = vi.spyOn(auth.api, "verifyTOTP");
    try {
      expect(await confirmTwoFactor(cookie, userId, await totpFor(key))).toEqual({ status: "refused", reason: "locked" });
      expect(verifier).not.toHaveBeenCalled();
    } finally {
      verifier.mockRestore();
      await clearWrongCodes(userId);
    }
    expect((await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId)))[0].on).toBe(false);
  });

  it("20 wrong codes at the same moment: at most 5 reach Better Auth", async () => {
    const { cookie, userId } = await started();
    const verifier = vi.spyOn(auth.api, "verifyTOTP");
    try {
      await Promise.all(Array.from({ length: 20 }, () => confirmTwoFactor(cookie, userId, "000000")));
      expect(verifier).toHaveBeenCalledTimes(5);
    } finally {
      verifier.mockRestore();
      await clearWrongCodes(userId);
    }
  });

  it("with two-factor already on it is refused as already-on without asking Better Auth, and counts no guess", async () => {
    const { cookie, userId, key } = await started();
    const on = await confirmTwoFactor(cookie, userId, await totpFor(key));
    if (on.status !== "on") throw new Error("confirm failed");
    const signed = cookieHeader(on.responseHeaders);
    const verifier = vi.spyOn(auth.api, "verifyTOTP");
    try {
      for (let i = 0; i < 7; i++) expect(await confirmTwoFactor(signed, userId, "000000")).toEqual({ status: "refused", reason: "already-on" });
      expect(verifier).not.toHaveBeenCalled();
    } finally {
      verifier.mockRestore();
    }
  });

  it("the right code turns it on, swaps the session, and the new cookie is signed in with two_factor_at set", async () => {
    const { cookie, userId, key } = await started();
    const reply = await confirmTwoFactor(cookie, userId, await totpFor(key));
    expect(reply.status).toBe("on");
    if (reply.status !== "on") return;
    expect((await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId)))[0].on).toBe(true);
    const fresh = cookieHeader(reply.responseHeaders);
    expect(await signedIn(fresh)).toBe(true);
    expect(await signedIn(cookie)).toBe(false);
    const rows = await db.select({ at: session.twoFactorAt }).from(session).where(eq(session.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].at).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - rows[0].at!.getTime())).toBeLessThan(60_000);
  });

  it("signs out every other session of the account, on other devices too", async () => {
    const { cookie, userId, key, email } = await started();
    const other = await signInAgain(email);
    const another = await signInAgain(email);
    expect(await signedIn(other)).toBe(true);
    const reply = await confirmTwoFactor(cookie, userId, await totpFor(key));
    expect(reply.status).toBe("on");
    expect(await signedIn(other)).toBe(false);
    expect(await signedIn(another)).toBe(false);
    expect(await db.select().from(session).where(eq(session.userId, userId))).toHaveLength(1);
  });

  it("keeps a session that began without \"Keep me signed in\" short (the swap would give it 7 days)", async () => {
    const { cookie, userId, key } = await started();
    const dontRemember = (await auth.$context).authCookies.dontRememberToken.name;
    const short = new Headers({ cookie: `${cookie.get("cookie")}; ${dontRemember}=x` });
    expect((await confirmTwoFactor(short, userId, await totpFor(key))).status).toBe("on");
    const [row] = await db.select({ expiresAt: session.expiresAt }).from(session).where(eq(session.userId, userId));
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThan(25 * HOUR);
  });

  it("leaves a remembered session at its full length", async () => {
    const { cookie, userId, key } = await started();
    expect((await confirmTwoFactor(cookie, userId, await totpFor(key))).status).toBe("on");
    const [row] = await db.select({ expiresAt: session.expiresAt }).from(session).where(eq(session.userId, userId));
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(24 * HOUR);
  });

  it("once on, starting again is refused as already on", async () => {
    const { cookie, userId, key } = await started();
    const reply = await confirmTwoFactor(cookie, userId, await totpFor(key));
    if (reply.status !== "on") throw new Error("confirm failed");
    expect(await startTwoFactor(cookieHeader(reply.responseHeaders), userId, TEST_PASSWORD)).toEqual({ status: "refused", reason: "already-on" });
  });
});

describe("newBackupCodes", () => {
  it("is refused while two-factor is off", async () => {
    const account = await makeAccount();
    expect(await newBackupCodes(account.cookie, account.userId, TEST_PASSWORD)).toEqual({ status: "refused", reason: "not-on" });
  });

  it("gives ten new codes for the right password and refuses a wrong one", async () => {
    const { cookie, userId, key } = await started();
    const on = await confirmTwoFactor(cookie, userId, await totpFor(key));
    if (on.status !== "on") throw new Error("confirm failed");
    const signed = cookieHeader(on.responseHeaders);
    expect(await newBackupCodes(signed, userId, "not-it-at-all")).toEqual({ status: "refused", reason: "password" });
    const reply = await newBackupCodes(signed, userId, TEST_PASSWORD);
    expect(reply.status).toBe("codes");
    if (reply.status === "codes") expect(reply.backupCodes).toHaveLength(10);
    await clearWrongGuesses(userId);
  });
});
