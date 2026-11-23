// A company role always requires two-factor (DECISIONS 11-23), against the development database: the requirement
// names the company, so Turn off is refused with its name, and a person with no company role is not asked.

import { afterAll, describe, expect, it } from "vitest";

import { assignCompanyRole, dropCompanies, makeCompany, makeRegion } from "@/lib/companies/test-companies";
import { clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { clearWrongGuesses } from "@/lib/password-guesses";

import { disableTwoFactor } from "./disable";
import { twoFactorRequirement } from "./required-by";
import { confirmTwoFactor, startTwoFactor } from "./setup";
import { cookieHeader, dropAccounts, makeAccount, TEST_PASSWORD, totpFor } from "./test-accounts";
import { setupKey } from "./totp-key";

afterAll(async () => {
  await dropCompanies();
  await dropAccounts();
});

async function accountWithTwoFactor() {
  const account = await makeAccount();
  const start = await startTwoFactor(account.cookie, account.userId, TEST_PASSWORD);
  if (start.status !== "started") throw new Error("start refused");
  const key = setupKey(start.otpauthUri)!;
  const done = await confirmTwoFactor(account.cookie, account.userId, await totpFor(key));
  if (done.status !== "on") throw new Error("confirm refused");
  await Promise.all([clearWrongCodes(account.userId), clearWrongGuesses(account.userId)]);
  return { ...account, key, cookie: cookieHeader(done.responseHeaders) };
}

describe("twoFactorRequirement for company roles", { timeout: 30_000 }, () => {
  it("names the company for its owner, a corporate admin and a regional manager, and nothing for anyone else", async () => {
    const owner = await makeAccount();
    const { id } = await makeCompany("req", owner.userId);
    const admin = await makeAccount();
    await assignCompanyRole(id, admin.userId, "corporate_admin");
    const regional = await makeAccount();
    await assignCompanyRole(id, regional.userId, "regional_manager", await makeRegion(id, "North"));
    const nobody = await makeAccount();
    for (const who of [owner, admin, regional]) expect(await twoFactorRequirement(who.userId), who.userId).toEqual({ isAdmin: false, store: expect.stringContaining("Test company req") });
    expect(await twoFactorRequirement(nobody.userId)).toEqual({ isAdmin: false, store: null });
  });

  it("refuses Turn off to an owner and to a corporate admin, naming the company, and the factor stays on", async () => {
    const owner = await accountWithTwoFactor();
    const { id } = await makeCompany("keep", owner.userId);
    const admin = await accountWithTwoFactor();
    await assignCompanyRole(id, admin.userId, "corporate_admin");
    for (const who of [owner, admin]) {
      const reply = await disableTwoFactor(who.cookie, who.userId, TEST_PASSWORD, await totpFor(who.key));
      expect(reply, who.userId).toMatchObject({ status: "refused", reason: "required", store: expect.stringContaining("Test company keep") });
    }
  });
});
