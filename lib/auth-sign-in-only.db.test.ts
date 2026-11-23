// The two sign-in verify routes refuse a request that has a session (lib/auth-sign-in-only.ts),
// through the same handler the browser reaches, and stay open to the server's own calls.

import { afterAll, describe, expect, it } from "vitest";

import { auth } from "@/lib/auth";
import { clearWrongCodes } from "@/lib/admin/two-factor-guesses";
import { dropAccounts, makeAccount } from "@/lib/two-factor/test-accounts";

afterAll(dropAccounts);

const post = (path: string, cookie?: Headers) => {
  const headers = new Headers({ "content-type": "application/json", origin: "http://localhost:3000" });
  if (cookie?.get("cookie")) headers.set("cookie", cookie.get("cookie")!);
  return auth.handler(new Request(`http://localhost:3000/api/auth${path}`, { method: "POST", headers, body: JSON.stringify({ code: "000000" }) }));
};

describe("sign-in-only verify routes", () => {
  for (const path of ["/two-factor/verify-totp", "/two-factor/verify-backup-code"]) {
    it(`${path}: 404 with a session, and a refusal that is not a 404 without one`, async () => {
      const { cookie } = await makeAccount();
      expect((await post(path, cookie)).status).toBe(404);
      expect((await post(path)).status).not.toBe(404);
    });
  }

  it("the server's own call keeps working with a session (the confirm and the step-up use it)", async () => {
    const { cookie, userId } = await makeAccount();
    // No secret exists yet, so Better Auth answers "TOTP not enabled": a 400 from the endpoint itself, not our 404.
    await expect(auth.api.verifyTOTP({ body: { code: "000000" }, headers: cookie })).rejects.toMatchObject({ statusCode: 400 });
    await clearWrongCodes(userId);
  });
});
