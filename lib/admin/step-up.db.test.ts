// The admin step-up (spec 0.7.1 8.3, A0 findings 2): with a session present Better Auth counts no
// wrong codes and makes no session, so the app limits wrong codes to 5 per 10 minutes and sets
// `two_factor_at` itself. Against the development database, with a real account that turned two-factor on.

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { session } from "@/db/auth-schema";
import { confirmTwoFactor, startTwoFactor } from "@/lib/two-factor/setup";
import { cookieHeader, dropAccounts, makeAccount, TEST_PASSWORD, totpFor } from "@/lib/two-factor/test-accounts";
import { setupKey } from "@/lib/two-factor/totp-key";

import { clearWrongCodes } from "./two-factor-guesses";
import { verifyAdminCode } from "./step-up";

afterAll(dropAccounts);

const HOUR = 3_600_000;

/** An account with two-factor on, whose one session last passed a code 13 hours ago (so stale). */
async function staleAdmin() {
  const account = await makeAccount();
  const start = await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD);
  if (start.status !== "started") throw new Error("start refused");
  const key = setupKey(start.otpauthUri)!;
  const on = await confirmTwoFactor(account.cookie, account.userId, await totpFor(key));
  if (on.status !== "on") throw new Error("confirm refused");
  const [row] = await db.select({ id: session.id }).from(session).where(eq(session.userId, account.userId));
  await db.update(session).set({ twoFactorAt: new Date(Date.now() - 13 * HOUR) }).where(eq(session.id, row.id));
  return { ...account, key, sessionId: row.id, cookie: cookieHeader(on.responseHeaders) };
}

const enteredAt = async (id: string) => (await db.select({ at: session.twoFactorAt }).from(session).where(eq(session.id, id)))[0].at!;

describe("verifyAdminCode", () => {
  it("a right code sets two_factor_at on this session and makes no new one", async () => {
    const a = await staleAdmin();
    expect(await verifyAdminCode(a.cookie, a.userId, a.sessionId, await totpFor(a.key))).toEqual({ status: "ok" });
    expect(Date.now() - (await enteredAt(a.sessionId)).getTime()).toBeLessThan(60_000);
    expect(await db.select().from(session).where(eq(session.userId, a.userId))).toHaveLength(1);
  });

  it("a wrong code is refused and leaves the old time", async () => {
    const a = await staleAdmin();
    const before = await enteredAt(a.sessionId);
    expect(await verifyAdminCode(a.cookie, a.userId, a.sessionId, "000000")).toEqual({ status: "refused", reason: "code" });
    expect((await enteredAt(a.sessionId)).getTime()).toBe(before.getTime());
    await clearWrongCodes(a.userId);
  });

  it("five wrong codes stop the next try, even a right one, and change nothing", async () => {
    const a = await staleAdmin();
    for (let i = 0; i < 5; i++) expect((await verifyAdminCode(a.cookie, a.userId, a.sessionId, "000000")).status).toBe("refused");
    expect(await verifyAdminCode(a.cookie, a.userId, a.sessionId, await totpFor(a.key))).toEqual({ status: "refused", reason: "locked" });
    expect(Date.now() - (await enteredAt(a.sessionId)).getTime()).toBeGreaterThan(12 * HOUR);
    await clearWrongCodes(a.userId);
  });

  it("a right code forgets the wrong ones before it", async () => {
    const a = await staleAdmin();
    for (let i = 0; i < 4; i++) await verifyAdminCode(a.cookie, a.userId, a.sessionId, "000000");
    expect((await verifyAdminCode(a.cookie, a.userId, a.sessionId, await totpFor(a.key))).status).toBe("ok");
    for (let i = 0; i < 4; i++) expect(await verifyAdminCode(a.cookie, a.userId, a.sessionId, "000000")).toEqual({ status: "refused", reason: "code" });
    await clearWrongCodes(a.userId);
  });

  it("cannot move another session's time: only the named session of this account is touched", async () => {
    const a = await staleAdmin();
    const b = await staleAdmin();
    expect((await verifyAdminCode(a.cookie, a.userId, b.sessionId, await totpFor(a.key))).status).toBe("ok");
    expect(Date.now() - (await enteredAt(b.sessionId)).getTime()).toBeGreaterThan(12 * HOUR);
  });
});
