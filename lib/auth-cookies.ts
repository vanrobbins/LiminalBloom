// Carries the cookies Better Auth set during a server-side call to the browser.
//
// A call to `auth.api.*` from a server action builds its own response, and nothing
// copies its Set-Cookie to the one the browser receives. Most calls set none, but
// changePassword with revokeOtherSessions deletes every session and starts a new one for
// the caller: without its cookie the caller would be signed out too. This does what
// better-auth's `nextCookies()` plugin does, for the one place that needs it. The plugin is
// not used because it also changes how session refresh behaves in every page render.

import "server-only";

import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { cookies } from "next/headers";

/** Sets each cookie in a Better Auth response's `Set-Cookie` on the current Server Action's response. */
export async function applyAuthCookies(responseHeaders: Headers): Promise<void> {
  const setCookie = responseHeaders.get("set-cookie");
  if (!setCookie) return;
  const jar = await cookies();
  parseSetCookieHeader(setCookie).forEach((cookie, name) => {
    if (name) jar.set(name, cookie.value, toCookieOptions(cookie));
  });
}
