// A passkey is a second factor for /admin (spec 0.7.1 8.4, A3c), against the development database: an admin
// with only a passkey (no authenticator app) is not sent to set up two-step sign-in; a session made by a
// passkey sign-in has `two_factor_at` (the session hook, lib/passkeys/add-gate.db.test.ts) and meets the
// 12-hour rule; one without it is sent to the step-up, where "Use a passkey" makes a new session.

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { passkey, session } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { addPasskeyRow } from "@/lib/passkeys/test-passkeys";
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

import { requirePlatformAdmin, requirePlatformAdminAccount, requirePlatformAdminForAction } from "./guard";

afterAll(dropAccounts);
beforeEach(() => {
  state.headers = new Headers();
});

const HOUR = 3_600_000;
const refusal = (work: Promise<unknown>) => work.then(() => "passed", (e: Error) => e.message);

/** An admin with no authenticator app, with or without a passkey, whose session passed a second factor `enteredAgo` ms ago (null = never). */
async function passkeyAdmin(options: { passkey: boolean; enteredAgo: number | null }) {
  const account = await makeAccount();
  await db.insert(platformAdmins).values({ userId: account.userId, addedByName: "test" });
  if (options.passkey) await addPasskeyRow(account.userId);
  if (options.enteredAgo !== null) await db.update(session).set({ twoFactorAt: new Date(Date.now() - options.enteredAgo) }).where(eq(session.userId, account.userId));
  state.headers = account.cookie;
  return account;
}

describe("an admin with a passkey and no authenticator app", () => {
  it("passes /admin when the session passed a passkey sign-in inside 12 hours", async () => {
    await passkeyAdmin({ passkey: true, enteredAgo: HOUR });
    await expect(requirePlatformAdmin()).resolves.toMatchObject({ twoFactorEnabled: false, passkey: true });
    expect((await requirePlatformAdminForAction()).status).toBe("ok");
  });

  it("is sent to the step-up, not to setup, when the session has no recent second factor (a password sign-in, or older than 12 hours)", async () => {
    await passkeyAdmin({ passkey: true, enteredAgo: null });
    expect(await refusal(requirePlatformAdmin())).toBe("redirect:/admin/verify");
    await passkeyAdmin({ passkey: true, enteredAgo: 13 * HOUR });
    expect(await refusal(requirePlatformAdmin())).toBe("redirect:/admin/verify");
    expect(await requirePlatformAdminForAction()).toEqual({ status: "forbidden" });
  });

  it("the account page guard reports the passkey, so the step-up page offers it", async () => {
    await passkeyAdmin({ passkey: true, enteredAgo: null });
    expect(await requirePlatformAdminAccount()).toMatchObject({ twoFactorEnabled: false, passkey: true });
  });

  it("without the passkey it is back to setup; removing the passkey takes effect on the next request", async () => {
    const a = await passkeyAdmin({ passkey: true, enteredAgo: HOUR });
    await expect(requirePlatformAdmin()).resolves.toBeTruthy();
    await db.delete(passkey).where(eq(passkey.userId, a.userId));
    expect(await refusal(requirePlatformAdmin())).toBe("redirect:/admin/two-factor");
  });
});
