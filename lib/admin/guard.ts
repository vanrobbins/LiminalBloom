// Who may use /admin (spec 0.7.1 7.2). Read from the database on every request: the admin row, the
// account's `two_factor_enabled` (the authenticator app) and its passkeys (either is a second factor, A3c) and this session's `two_factor_at`, never from a cached session
// payload or anything the client sends. Every /admin page calls a page guard; every admin server
// action awaits an action guard first (app/server-actions-guard.test.ts checks both the first and
// that its `forbidden` answer is branched on).
//
// A signed-out visitor goes to sign in and back; a signed-in person who is not an admin gets
// notFound(), so the area is not advertised. The page guards send an admin who lacks a fresh second
// factor to where they can get one; the action guards answer { status: "forbidden" }.

import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { session, user } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hasPasskey } from "@/lib/passkeys/list";

import { adminStanding, type AdminStanding } from "./freshness";

export type AdminAccount = { userId: string; sessionId: string; name: string; email: string; twoFactorEnabled: boolean; passkey: boolean; twoFactorAt: Date | null };

const SIGN_IN = "/sign-in?next=/admin";

/** One read per request: the account and where it stands, or null when nobody is signed in. */
const readAdmin = cache(async (): Promise<{ standing: AdminStanding; account: AdminAccount | null }> => {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) return { standing: "signed-out", account: null };
  const [row] = await db
    .select({ admin: platformAdmins.userId, twoFactorEnabled: user.twoFactorEnabled, twoFactorAt: session.twoFactorAt })
    .from(user)
    .leftJoin(platformAdmins, eq(platformAdmins.userId, user.id))
    .leftJoin(session, eq(session.id, current.session.id))
    .where(eq(user.id, current.user.id));
  if (!row) return { standing: "signed-out", account: null };
  // Only an admin's passkeys matter here, so a non-admin costs no extra query.
  const passkey = row.admin !== null && (await hasPasskey(current.user.id));
  const account = { userId: current.user.id, sessionId: current.session.id, name: current.user.name, email: current.user.email, twoFactorEnabled: row.twoFactorEnabled === true, passkey, twoFactorAt: row.twoFactorAt ?? null };
  const standing = adminStanding({ signedIn: true, isAdmin: row.admin !== null, twoFactorEnabled: account.twoFactorEnabled || passkey, twoFactorAt: account.twoFactorAt });
  return { standing, account };
});

/** For the two-factor setup and verify pages: a signed-in admin, whatever their factor state. */
export async function requirePlatformAdminAccount(): Promise<AdminAccount> {
  const { standing, account } = await readAdmin();
  if (standing === "signed-out" || !account) redirect(SIGN_IN);
  if (standing === "not-admin") notFound();
  return account;
}

/** For every other /admin page: an admin with two-factor on and a code entered inside 12 hours. */
export async function requirePlatformAdmin(): Promise<AdminAccount> {
  const { standing, account } = await readAdmin();
  if (standing === "signed-out" || !account) redirect(SIGN_IN);
  if (standing === "not-admin") notFound();
  if (standing === "needs-two-factor") redirect("/admin/two-factor");
  if (standing === "needs-verify") redirect("/admin/verify");
  return account;
}

export type AdminCheck = { status: "ok"; admin: AdminAccount } | { status: "forbidden" };

/** For admin server actions: `requirePlatformAdmin`'s rule, answered as an outcome. Signed-out callers are redirected, as the page guards do. */
export async function requirePlatformAdminForAction(): Promise<AdminCheck> {
  const { standing, account } = await readAdmin();
  if (standing === "signed-out" || !account) redirect(SIGN_IN);
  return standing === "ok" ? { status: "ok", admin: account } : { status: "forbidden" };
}

/** For the setup and step-up actions, which exist to get a fresh factor: any admin, whatever their factor state. */
export async function requirePlatformAdminAccountForAction(): Promise<AdminCheck> {
  const { standing, account } = await readAdmin();
  if (standing === "signed-out" || !account) redirect(SIGN_IN);
  return standing === "not-admin" ? { status: "forbidden" } : { status: "ok", admin: account };
}
