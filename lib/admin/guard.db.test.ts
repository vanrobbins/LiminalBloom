// The admin guards (spec 0.7.1 7.2) against the development database with real accounts and
// sessions. Next's redirect() and notFound() throw to stop rendering; these stand-ins do too.

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

import { requirePlatformAdmin, requirePlatformAdminAccount, requirePlatformAdminAccountForAction, requirePlatformAdminForAction } from "./guard";

afterAll(dropAccounts);
beforeEach(() => {
  state.headers = new Headers();
});

const HOUR = 3_600_000;

/** An account asking from its own session, made an admin or not, with two-factor on or off and its code entered `enteredAgo` ms ago (null = never). */
async function asking(options: { admin: boolean; twoFactor: boolean; enteredAgo: number | null }) {
  const account = await makeAccount();
  if (options.admin) await db.insert(platformAdmins).values({ userId: account.userId, addedByName: "test" });
  await db.update(user).set({ twoFactorEnabled: options.twoFactor }).where(eq(user.id, account.userId));
  if (options.enteredAgo !== null) await db.update(session).set({ twoFactorAt: new Date(Date.now() - options.enteredAgo) }).where(eq(session.userId, account.userId));
  state.headers = account.cookie;
  return account;
}

const refusal = (work: Promise<unknown>) => work.then(() => "passed", (e: Error) => e.message);

describe("requirePlatformAdminAccount", () => {
  it("sends a signed-out visitor to sign in and back to /admin", async () => {
    expect(await refusal(requirePlatformAdminAccount())).toBe("redirect:/sign-in?next=/admin");
  });
  it("answers a signed-in non-admin with notFound, not a redirect: the area is not advertised", async () => {
    await asking({ admin: false, twoFactor: true, enteredAgo: 0 });
    expect(await refusal(requirePlatformAdminAccount())).toBe("notFound");
  });
  it("lets an admin through with no two-factor and returns who they are", async () => {
    const { userId } = await asking({ admin: true, twoFactor: false, enteredAgo: null });
    expect(await requirePlatformAdminAccount()).toMatchObject({ userId, twoFactorEnabled: false, twoFactorAt: null });
  });
  it("a cookie whose session is gone is sent to sign in", async () => {
    const account = await asking({ admin: true, twoFactor: true, enteredAgo: 0 });
    await db.delete(session).where(eq(session.userId, account.userId));
    expect(await refusal(requirePlatformAdminAccount())).toBe("redirect:/sign-in?next=/admin");
  });
});

describe("requirePlatformAdmin", () => {
  it("passes an admin with two-factor on and a code entered inside 12 hours", async () => {
    await asking({ admin: true, twoFactor: true, enteredAgo: 11 * HOUR });
    await expect(requirePlatformAdmin()).resolves.toMatchObject({ twoFactorEnabled: true });
  });
  it("sends an admin without two-factor to set it up", async () => {
    await asking({ admin: true, twoFactor: false, enteredAgo: null });
    expect(await refusal(requirePlatformAdmin())).toBe("redirect:/admin/two-factor");
  });
  it("sends a stale session to the step-up", async () => {
    await asking({ admin: true, twoFactor: true, enteredAgo: 13 * HOUR });
    expect(await refusal(requirePlatformAdmin())).toBe("redirect:/admin/verify");
  });
  it("sends a session that never passed a code (a trusted-device sign-in) to the step-up", async () => {
    await asking({ admin: true, twoFactor: true, enteredAgo: null });
    expect(await refusal(requirePlatformAdmin())).toBe("redirect:/admin/verify");
  });
  it("answers a non-admin with notFound whatever the factor state", async () => {
    await asking({ admin: false, twoFactor: false, enteredAgo: null });
    expect(await refusal(requirePlatformAdmin())).toBe("notFound");
  });
});

describe("requirePlatformAdminForAction", () => {
  it("is ok for a fresh admin", async () => {
    const { userId } = await asking({ admin: true, twoFactor: true, enteredAgo: HOUR });
    await expect(requirePlatformAdminForAction()).resolves.toMatchObject({ status: "ok", admin: { userId } });
  });
  it("is forbidden for a non-admin, an admin without two-factor, and a stale or code-less session", async () => {
    await asking({ admin: false, twoFactor: true, enteredAgo: 0 });
    expect(await requirePlatformAdminForAction()).toEqual({ status: "forbidden" });
    await asking({ admin: true, twoFactor: false, enteredAgo: null });
    expect(await requirePlatformAdminForAction()).toEqual({ status: "forbidden" });
    await asking({ admin: true, twoFactor: true, enteredAgo: 13 * HOUR });
    expect(await requirePlatformAdminForAction()).toEqual({ status: "forbidden" });
    await asking({ admin: true, twoFactor: true, enteredAgo: null });
    expect(await requirePlatformAdminForAction()).toEqual({ status: "forbidden" });
  });
  it("sends a signed-out caller to sign in, as the page guards do", async () => {
    expect(await refusal(requirePlatformAdminForAction())).toBe("redirect:/sign-in?next=/admin");
  });
});

describe("requirePlatformAdminAccountForAction (setup and step-up actions)", () => {
  it("is ok for an admin whatever the factor state, forbidden for anyone else", async () => {
    await asking({ admin: true, twoFactor: false, enteredAgo: null });
    expect((await requirePlatformAdminAccountForAction()).status).toBe("ok");
    await asking({ admin: false, twoFactor: false, enteredAgo: null });
    expect(await requirePlatformAdminAccountForAction()).toEqual({ status: "forbidden" });
  });
});

describe("the guard reads the database on every request", () => {
  it("removing the admin row takes effect on the next request", async () => {
    const { userId } = await asking({ admin: true, twoFactor: true, enteredAgo: 0 });
    await expect(requirePlatformAdmin()).resolves.toBeTruthy();
    await db.delete(platformAdmins).where(eq(platformAdmins.userId, userId));
    expect(await refusal(requirePlatformAdmin())).toBe("notFound");
  });
});
