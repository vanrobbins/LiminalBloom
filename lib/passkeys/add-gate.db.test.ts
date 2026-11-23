// Adding a passkey needs the password just before (lib/passkeys/add-gate.ts), through the same handler the
// browser reaches; the session hook sets `twoFactorAt` for a passkey sign-in and not for a registration
// (spec 0.7.1 8.4 item 1b); and the closed passkey routes answer 404.

import { afterAll, describe, expect, it } from "vitest";

import { auth } from "@/lib/auth";
import { clearWrongGuesses } from "@/lib/password-guesses";
import { dropAccounts, makeAccount, TEST_PASSWORD } from "@/lib/two-factor/test-accounts";

import { grantPasskeyAdd, hasPasskeyAddGrant, spendPasskeyAddGrant } from "./add-gate";
import { allowPasskeyAdd } from "./change";

afterAll(dropAccounts);

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
    expect(await hasPasskeyAddGrant(a.userId)).toBe(false);
    expect(await allowPasskeyAdd(a.cookie, a.userId, TEST_PASSWORD)).toEqual({ status: "ok" });
    expect(await hasPasskeyAddGrant(a.userId)).toBe(true);
    const options = await call("/passkey/generate-register-options", a.cookie);
    expect(options.status).toBe(200);
    expect(((await options.json()) as { authenticatorSelection?: { userVerification?: string } }).authenticatorSelection?.userVerification).toBe("required");
    await clearWrongGuesses(a.userId);
  });

  it("a grant lasts five minutes, and a verify attempt spends it", async () => {
    const a = await makeAccount();
    await grantPasskeyAdd(a.userId, new Date(Date.now() - 6 * 60_000));
    expect(await hasPasskeyAddGrant(a.userId)).toBe(false);
    await grantPasskeyAdd(a.userId);
    // The verify itself fails (no real credential), but the grant is spent on the way in.
    expect((await call("/passkey/verify-registration", a.cookie, "POST")).status).not.toBe(403);
    expect(await hasPasskeyAddGrant(a.userId)).toBe(false);
    await spendPasskeyAddGrant(a.userId);
  });

  it("someone else's grant does not open it, and a request with no session is Better Auth's to refuse (401, not 403)", async () => {
    const a = await makeAccount();
    const b = await makeAccount();
    await grantPasskeyAdd(b.userId);
    expect((await call("/passkey/generate-register-options", a.cookie)).status).toBe(403);
    expect((await call("/passkey/generate-register-options")).status).toBe(401);
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
