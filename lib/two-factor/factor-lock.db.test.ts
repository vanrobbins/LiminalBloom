// An account that needs two-factor must never be left with none by two writes at once: removing its last
// passkey while the app is turned off, and the reverse (review LOW 7); and turning off an app that is not on
// is refused before a code is tried (LOW 6). Against the development database.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { passkey, user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { clearWrongGuesses } from "@/lib/password-guesses";
import { removePasskey } from "@/lib/passkeys/change";
import { addPasskeyRow } from "@/lib/passkeys/test-passkeys";

import { disableTwoFactor } from "./disable";
import { claimTurnOff, releaseTurnOff } from "./factor-lock";
import { accountWithApp, dropAccounts, makeAccount, TEST_PASSWORD, totpFor } from "./test-accounts";

afterAll(dropAccounts);

const factorsLeft = async (userId: string) => {
  const [row] = await db.select({ on: user.twoFactorEnabled }).from(user).where(eq(user.id, userId));
  return { app: row.on === true, passkeys: (await db.select().from(passkey).where(eq(passkey.userId, userId))).length };
};

describe("the turn-off mark", () => {
  it("is taken only while a passkey is there, and while it is live the passkey cannot be removed", async () => {
    const a = await accountWithApp({ admin: true });
    expect(await claimTurnOff(a.userId)).toBe(false);
    const key = await addPasskeyRow(a.userId);
    expect(await claimTurnOff(a.userId)).toBe(true);
    expect(await removePasskey(a.cookie, a.userId, key.id, TEST_PASSWORD)).toMatchObject({ status: "refused", reason: "last" });
    expect((await factorsLeft(a.userId)).passkeys).toBe(1);
    await releaseTurnOff(a.userId);
    await clearWrongGuesses(a.userId);
    expect(await removePasskey(a.cookie, a.userId, key.id, TEST_PASSWORD)).toEqual({ status: "ok" });
    await clearWrongGuesses(a.userId);
  });
});

describe("turning the app off and removing the last passkey at the same moment", () => {
  it("one of them wins and the admin keeps a second factor, every time", async () => {
    const accounts = await Promise.all(Array.from({ length: 3 }, () => accountWithApp({ admin: true })));
    const keys = await Promise.all(accounts.map((a) => addPasskeyRow(a.userId)));
    const outcomes = await Promise.all(
      accounts.map(async (a, i) => {
        const [off, removed] = await Promise.all([disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, await totpFor(a.key)), removePasskey(a.cookie, a.userId, keys[i].id, TEST_PASSWORD)]);
        return { off: off.status, removed: removed.status, left: await factorsLeft(a.userId) };
      }),
    );
    for (const { left, off, removed } of outcomes) {
      expect(left.app || left.passkeys > 0).toBe(true);
      expect(off === "off" && removed === "ok").toBe(false);
    }
  }, 60_000);
});

describe("turning off when the app is not on", () => {
  it("is refused as not-on without trying a code, for a passkey-only account too", async () => {
    const a = await makeAccount();
    await addPasskeyRow(a.userId);
    const verifier = vi.spyOn(auth.api, "verifyTOTP");
    try {
      expect(await disableTwoFactor(a.cookie, a.userId, TEST_PASSWORD, "123456")).toEqual({ status: "refused", reason: "not-on" });
      expect(verifier).not.toHaveBeenCalled();
    } finally {
      verifier.mockRestore();
    }
  });
});
