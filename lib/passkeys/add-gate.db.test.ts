// Adding a passkey needs the password just before (lib/passkeys/add-gate.ts), through the same handler the
// browser reaches; the session hook sets `twoFactorAt` for a passkey sign-in and not for a registration
// (spec 0.7.1 8.4 item 1b); and the closed passkey routes answer 404.

import { afterAll, describe, expect, it } from "vitest";

import { auth } from "@/lib/auth";
import { clearWrongGuesses } from "@/lib/password-guesses";
import { claimCodeGuess, clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { confirmTwoFactor, startTwoFactor } from "@/lib/two-factor/setup";
import { cookieHeader, dropAccounts, makeAccount, signInAgain, TEST_PASSWORD, totpFor } from "@/lib/two-factor/test-accounts";
import { setupKey } from "@/lib/two-factor/totp-key";

import { grantPasskeyAdd, hasPasskeyAddGrant, spendPasskeyAddGrant } from "./add-gate";
import { allowPasskeyAdd } from "./change";

afterAll(dropAccounts);

const sidOf = async (cookie: Headers) => (await auth.api.getSession({ headers: cookie }))!.session.id;

const ORIGIN = "http://localhost:3000";
const call = (path: string, cookie?: Headers, method = "GET") => {
  const headers = new Headers({ "content-type": "application/json", origin: ORIGIN });
  if (cookie?.get("cookie")) headers.set("cookie", cookie.get("cookie")!);
  return auth.handler(new Request(`${ORIGIN}/api/auth${path}`, { method, headers, ...(method === "POST" ? { body: JSON.stringify({ response: {} }) } : {}) }));
};

describe("the password gate on adding a passkey", () => {
  it("refuses the registration options and the verify with a 403 until the password was entered", async () => {
    const { cookie } = await makeAccount();
    const options = await call("/passkey/generate-register-options", cookie);
    expect(options.status).toBe(403);
    expect(((await options.json()) as { code?: string }).code).toBe("PASSKEY_NEEDS_PASSWORD");
    expect((await call("/passkey/verify-registration", cookie, "POST")).status).toBe(403);
  });

  it("a right password opens the options, and a wrong one does not", async () => {
    const a = await makeAccount();
    expect(await allowPasskeyAdd(a.cookie, a.userId, "not-the-password-1")).toEqual({ status: "refused", reason: "password" });
    const sid = await sidOf(a.cookie);
    expect(await hasPasskeyAddGrant(a.userId, sid)).toBe(false);
    expect(await allowPasskeyAdd(a.cookie, a.userId, TEST_PASSWORD)).toEqual({ status: "ok" });
    expect(await hasPasskeyAddGrant(a.userId, sid)).toBe(true);
    const options = await call("/passkey/generate-register-options", a.cookie);
    expect(options.status).toBe(200);
    expect(((await options.json()) as { authenticatorSelection?: { userVerification?: string } }).authenticatorSelection?.userVerification).toBe("required");
    await clearWrongGuesses(a.userId);
  });

  it("a grant lasts five minutes, and a verify attempt spends it", async () => {
    const a = await makeAccount();
    const sid = await sidOf(a.cookie);
    await grantPasskeyAdd(a.userId, sid, new Date(Date.now() - 6 * 60_000));
    expect(await hasPasskeyAddGrant(a.userId, sid)).toBe(false);
    expect(await spendPasskeyAddGrant(a.userId, sid)).toBe(false);
    await grantPasskeyAdd(a.userId, sid);
    // The verify itself fails (no real credential), but the grant is spent on the way in.
    expect((await call("/passkey/verify-registration", a.cookie, "POST")).status).not.toBe(403);
    expect(await hasPasskeyAddGrant(a.userId, sid)).toBe(false);
    // Spent: a second verify is a 403.
    expect((await call("/passkey/verify-registration", a.cookie, "POST")).status).toBe(403);
  });

  it("is for the session that entered the password: another session of the same account is refused", async () => {
    const a = await makeAccount();
    const other = await signInAgain(a.email);
    await grantPasskeyAdd(a.userId, await sidOf(a.cookie));
    expect((await call("/passkey/generate-register-options", other)).status).toBe(403);
    expect((await call("/passkey/generate-register-options", a.cookie)).status).toBe(200);
  });

  it("is spent once even when two verifies arrive together", async () => {
    const a = await makeAccount();
    const sid = await sidOf(a.cookie);
    await grantPasskeyAdd(a.userId, sid);
    const spends = await Promise.all(Array.from({ length: 4 }, () => spendPasskeyAddGrant(a.userId, sid)));
    expect(spends.filter(Boolean)).toHaveLength(1);
    await grantPasskeyAdd(a.userId, sid);
    const verifies = await Promise.all([call("/passkey/verify-registration", a.cookie, "POST"), call("/passkey/verify-registration", a.cookie, "POST")]);
    expect(verifies.map((r) => r.status).filter((x) => x === 403)).toHaveLength(1);
  });

  it("someone else's grant does not open it, and a request with no session is Better Auth's to refuse (401, not 403)", async () => {
    const a = await makeAccount();
    const b = await makeAccount();
    await grantPasskeyAdd(b.userId, await sidOf(b.cookie));
    expect((await call("/passkey/generate-register-options", a.cookie)).status).toBe(403);
    expect((await call("/passkey/generate-register-options")).status).toBe(401);
  });
});

describe("adding a passkey to an account with an authenticator app", () => {
  async function accountWithApp() {
    const a = await makeAccount();
    const start = await startTwoFactor(a.cookie, a.userId, TEST_PASSWORD);
    if (start.status !== "started") throw new Error("start refused");
    const key = setupKey(start.otpauthUri)!;
    const done = await confirmTwoFactor(a.cookie, a.userId, await totpFor(key));
    if (done.status !== "on") throw new Error("confirm refused");
    await Promise.all([clearWrongCodes(a.userId), clearWrongGuesses(a.userId)]);
    return { ...a, key, cookie: cookieHeader(done.responseHeaders) };
  }

  it("needs a current code as well as the password: a missing or wrong code opens nothing", async () => {
    const a = await accountWithApp();
    expect(await allowPasskeyAdd(a.cookie, a.userId, TEST_PASSWORD)).toEqual({ status: "refused", reason: "code" });
    expect(await allowPasskeyAdd(a.cookie, a.userId, TEST_PASSWORD, "000000")).toEqual({ status: "refused", reason: "code" });
    expect(await allowPasskeyAdd(a.cookie, a.userId, "not-the-password-1", await totpFor(a.key))).toEqual({ status: "refused", reason: "password" });
    expect((await call("/passkey/generate-register-options", a.cookie)).status).toBe(403);
    await clearWrongCodes(a.userId);
    await clearWrongGuesses(a.userId);
  });

  it("opens the registration with the password and a right code", async () => {
    const a = await accountWithApp();
    expect(await allowPasskeyAdd(a.cookie, a.userId, TEST_PASSWORD, await totpFor(a.key))).toEqual({ status: "ok" });
    expect((await call("/passkey/generate-register-options", a.cookie)).status).toBe(200);
    await clearWrongCodes(a.userId);
  });

  it("counts a wrong code under the step-up's limit", async () => {
    const a = await accountWithApp();
    for (let i = 0; i < 5; i++) await allowPasskeyAdd(a.cookie, a.userId, TEST_PASSWORD, "000000");
    expect(await allowPasskeyAdd(a.cookie, a.userId, TEST_PASSWORD, await totpFor(a.key))).toEqual({ status: "refused", reason: "locked" });
    expect(await claimCodeGuess(a.userId)).toBe(false);
    await clearWrongCodes(a.userId);
  });
});

describe("the session hook", () => {
  const hook = (path: string | undefined) => {
    const before = auth.options.databaseHooks?.session?.create?.before as unknown as (s: Record<string, unknown>, c: { path?: string } | null) => Promise<{ data: { twoFactorAt: Date | null } }>;
    return before({ userId: "nobody" }, path === undefined ? null : { path });
  };
  it("stamps twoFactorAt on a passkey sign-in, not on a registration or a password sign-in", async () => {
    expect((await hook("/passkey/verify-authentication")).data.twoFactorAt).toBeInstanceOf(Date);
    expect((await hook("/passkey/verify-registration")).data.twoFactorAt).toBeNull();
    expect((await hook("/sign-in/email")).data.twoFactorAt).toBeNull();
    expect((await hook(undefined)).data.twoFactorAt).toBeNull();
  });
});

describe("the closed passkey routes", () => {
  it("answer 404 to a signed-in browser", async () => {
    const { cookie } = await makeAccount();
    for (const path of ["/passkey/list-user-passkeys"]) expect((await call(path, cookie)).status, path).toBe(404);
    for (const path of ["/passkey/delete-passkey", "/passkey/update-passkey"]) expect((await call(path, cookie, "POST")).status, path).toBe(404);
  });
});
