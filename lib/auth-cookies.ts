// Carries the cookies Better Auth set during a server-side call to the browser.
//
// A call to `auth.api.*` from a server action builds its own response, and nothing
// copies its Set-Cookie to the one the browser receives. Most calls set none, but
// changePassword with revokeOtherSessions deletes every session and starts a new one for
// the caller: without its cookie the caller would be signed out too. This does what
// better-auth's `nextCookies()` plugin does, for the one place that needs it. The plugin is
// not used because it also changes how session refresh behaves in every page render.

import "server-only";

import type { BetterAuthOptions } from "better-auth";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";

/** Sets each of Better Auth's cookies in a response's `Set-Cookie` on the current Server Action's response; any other cookie is left alone. */
export async function applyAuthCookies(responseHeaders: Headers): Promise<void> {
  const setCookie = responseHeaders.get("set-cookie");
  if (!setCookie) return;
  const jar = await cookies();
  // Better Auth's names are `<prefix>.<name>`, with `__Secure-` in front over https (default prefix "better-auth").
  const prefix = `${(auth.options as BetterAuthOptions).advanced?.cookiePrefix ?? "better-auth"}.`;
  const isTheirs = (name: string) => name.startsWith(prefix) || name.startsWith(`__Secure-${prefix}`);
  parseSetCookieHeader(setCookie).forEach((cookie, name) => {
    if (name && isTheirs(name)) jar.set(name, cookie.value, toCookieOptions(cookie));
  });
}
