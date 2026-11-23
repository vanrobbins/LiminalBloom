// `/change-password` is closed to the browser (lib/auth.ts, disabledPaths), and the app's own
// server action calls auth.api.changePassword instead. This proves with the real Better Auth
// against the development database that the server call still works with the path closed,
// that revokeOtherSessions signs out every other session, and the shape of the wrong-password error.

import { randomUUID } from "node:crypto";

import { APIError } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, session, user } from "@/db/auth-schema";
import { setActiveStore } from "@/lib/access/set-active-store";
import { auth } from "@/lib/auth";
import { dropStores, makeStore } from "@/lib/products/test-stores";

import { keepShortSessionShort } from "./change-password";

const created: string[] = [];
afterAll(async () => {
  await dropStores();
  for (const id of created) await db.delete(user).where(eq(user.id, id));
});

/** The Cookie header a browser would send back for a response's Set-Cookie. */
function cookieHeader(responseHeaders: Headers): Headers {
  const jar = [...parseSetCookieHeader(responseHeaders.get("set-cookie") ?? "").entries()].map(([name, c]) => `${name}=${c.value}`);
  return new Headers({ cookie: jar.join("; ") });
}

async function makeAccount(password: string) {
  const email = `test_pw_${randomUUID().slice(0, 8)}@example.com`;
  const { headers, response } = await auth.api.signUpEmail({ body: { name: "Pw Test", email, password }, returnHeaders: true });
  created.push(response.user.id);
  return { email, firstSession: cookieHeader(headers) };
}

const signedIn = async (cookie: Headers) => (await auth.api.getSession({ headers: cookie })) !== null;

describe("auth.api.changePassword with /change-password disabled", () => {
  it("changes the password, signs out every other session, and hands back a working session cookie", async () => {
    const { email, firstSession } = await makeAccount("old-password-1");
    const second = cookieHeader((await auth.api.signInEmail({ body: { email, password: "old-password-1" }, returnHeaders: true })).headers);
    expect(await signedIn(firstSession)).toBe(true);
    expect(await signedIn(second)).toBe(true);

    const { headers } = await auth.api.changePassword({ body: { currentPassword: "old-password-1", newPassword: "new-password-2", revokeOtherSessions: true }, headers: firstSession, returnHeaders: true });

    expect(await signedIn(firstSession)).toBe(false);
    expect(await signedIn(second)).toBe(false);
    // The caller's own session was replaced: the cookie in the response is signed in.
    expect(await signedIn(cookieHeader(headers))).toBe(true);
    await expect(auth.api.signInEmail({ body: { email, password: "old-password-1" } })).rejects.toThrow();
    await expect(auth.api.signInEmail({ body: { email, password: "new-password-2" } })).resolves.toBeTruthy();
  });

  it("a wrong current password is a 400 INVALID_PASSWORD and changes nothing", async () => {
    const { email, firstSession } = await makeAccount("old-password-1");
    const error = await auth.api.changePassword({ body: { currentPassword: "not-it-at-all", newPassword: "new-password-2", revokeOtherSessions: true }, headers: firstSession }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).status).toBe("BAD_REQUEST");
    expect((error as APIError).body).toMatchObject({ code: "INVALID_PASSWORD" });
    expect(await signedIn(firstSession)).toBe(true);
    await expect(auth.api.signInEmail({ body: { email, password: "old-password-1" } })).resolves.toBeTruthy();
  });
});

const HOUR = 3_600_000;
const expiryOf = async (token: string) => (await db.select({ at: session.expiresAt }).from(session).where(eq(session.token, token)))[0].at.getTime() - Date.now();

describe("the session a password change starts (keepShortSessionShort)", () => {
  /** Signs in the way the form does, with or without "Keep me signed in", changes the password, then does what the action does. */
  async function changeFrom(keepMeSignedIn: boolean) {
    const { email } = await makeAccount("old-password-1");
    const { headers: signIn } = await auth.api.signInEmail({ body: { email, password: "old-password-1", rememberMe: keepMeSignedIn }, returnHeaders: true });
    const request = cookieHeader(signIn);
    const { response } = await auth.api.changePassword({ body: { currentPassword: "old-password-1", newPassword: "new-password-2", revokeOtherSessions: true }, headers: request, returnHeaders: true });
    await keepShortSessionShort(response.token as string, request);
    return response.token as string;
  }

  it("is 24 hours when the person did not choose to stay signed in", async () => {
    const left = await expiryOf(await changeFrom(false));
    expect(left).toBeGreaterThan(23 * HOUR);
    expect(left).toBeLessThanOrEqual(24 * HOUR);
  });

  it("stays 7 days when they did", async () => {
    const left = await expiryOf(await changeFrom(true));
    expect(left).toBeGreaterThan(6.9 * 24 * HOUR);
    expect(left).toBeLessThanOrEqual(7 * 24 * HOUR);
  });
});

describe("the active store after a password change", () => {
  it("is the one the person was working in, not the first one they joined", async () => {
    const { email } = await makeAccount("old-password-1");
    const [{ id: userId }] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    const [first, second] = [await makeStore("pw-first"), await makeStore("pw-second")];
    for (const [i, store] of [first, second].entries()) await db.insert(member).values({ id: randomUUID(), organizationId: store, userId, role: "member", roleId: null, createdAt: new Date(Date.now() + i * 1000) });

    const request = cookieHeader((await auth.api.signInEmail({ body: { email, password: "old-password-1" }, returnHeaders: true })).headers);
    const current = await auth.api.getSession({ headers: request });
    expect(await setActiveStore(current!.session.id, userId, second)).toEqual({ status: "switched" });
    expect((await auth.api.getSession({ headers: request }))?.session.activeStoreId).toBe(second);

    const { headers } = await auth.api.changePassword({ body: { currentPassword: "old-password-1", newPassword: "new-password-2", revokeOtherSessions: true }, headers: request, returnHeaders: true });
    expect((await auth.api.getSession({ headers: cookieHeader(headers) }))?.session.activeStoreId).toBe(second);
  });
});
