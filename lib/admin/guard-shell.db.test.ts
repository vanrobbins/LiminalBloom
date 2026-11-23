// What the /admin layout draws the shell for (spec 0.7.1 7.2: the layout is not a guard). Only an admin who
// would pass requirePlatformAdmin gets the shell; everyone else (signed out, not an admin, no two-factor,
// a stale code) gets the bare page, so the setup and step-up pages are reachable and a non-admin's 404 carries no chrome.

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { session, user } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { dropAccounts, makeAccount } from "@/lib/two-factor/test-accounts";

const state = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

import { adminShellAccount } from "./guard";

afterAll(dropAccounts);
beforeEach(() => {
  state.headers = new Headers();
});

const HOUR = 3_600_000;

async function asking(options: { admin: boolean; twoFactor: boolean; enteredAgo: number | null }) {
  const account = await makeAccount();
  if (options.admin) await db.insert(platformAdmins).values({ userId: account.userId, addedByName: "test" });
  await db.update(user).set({ twoFactorEnabled: options.twoFactor }).where(eq(user.id, account.userId));
  if (options.enteredAgo !== null) await db.update(session).set({ twoFactorAt: new Date(Date.now() - options.enteredAgo) }).where(eq(session.userId, account.userId));
  state.headers = account.cookie;
  return account;
}

describe("adminShellAccount", () => {
  it("gives the account of an admin with two-factor and a code from the last 12 hours", async () => {
    const account = await asking({ admin: true, twoFactor: true, enteredAgo: HOUR });
    expect(await adminShellAccount()).toMatchObject({ userId: account.userId, email: account.email });
  });
  it("gives nothing, and never redirects or throws, for everyone else", async () => {
    expect(await adminShellAccount()).toBeNull();
    await asking({ admin: false, twoFactor: true, enteredAgo: HOUR });
    expect(await adminShellAccount()).toBeNull();
    await asking({ admin: true, twoFactor: false, enteredAgo: null });
    expect(await adminShellAccount()).toBeNull();
    await asking({ admin: true, twoFactor: true, enteredAgo: 13 * HOUR });
    expect(await adminShellAccount()).toBeNull();
    await asking({ admin: true, twoFactor: true, enteredAgo: null });
    expect(await adminShellAccount()).toBeNull();
  });
});
