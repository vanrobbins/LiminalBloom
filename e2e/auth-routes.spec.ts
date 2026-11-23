// Better Auth's organization endpoints are closed to the browser (spec 0.7 §4.5):
// its owner/admin check knows nothing of our roles, and three read routes list
// emails and invitation ids to any member. People, roles and invitations go
// through the app's own server actions. The router answers a disabled path with
// 404 before anything else runs, so the signed-in test account makes no difference.

import { expect, sizeOf, test } from "./fixtures";

const BASE = "/api/auth/organization/";

const POST_ONLY = ["invite-member", "cancel-invitation", "accept-invitation", "reject-invitation", "update-member-role", "remove-member", "leave", "update", "delete", "create"];
const GET_ONLY = ["list-invitations", "get-full-organization", "list-members", "get-invitation", "list-user-invitations"];

// Spellings that must not slip past an exact-match list: a trailing slash, upper case,
// a doubled slash, and one percent-encoded character in the name (the hyphen where
// there is one, otherwise the first letter). Checked by switching disabledPaths off:
// the plain name and the trailing slash then answer, so those two are what
// disabledPaths itself closes. The upper-case, double-slash and encoded variants
// already 404 without it (the router is case-sensitive, does not match a doubled
// slash, and does not decode %2D in the path); they stay as a guard in case that changes.
const encoded = (name: string) => (name.includes("-") ? name.replace("-", "%2D") : `%${name.charCodeAt(0).toString(16)}${name.slice(1)}`);
const variantsAt = (base: string, name: string) => [`${base}${name}`, `${base}${name}/`, `${base}${name.toUpperCase()}`, `${base}${name.toUpperCase()}/`, `${base}/${name}`, `${base}${encoded(name)}`];
const variants = (name: string) => variantsAt(BASE, name);

test.beforeEach(({}, testInfo) => {
  test.skip(sizeOf(testInfo) !== "desktop", "Server behaviour: one size is enough.");
});

test.describe("closed organization endpoints", () => {
  for (const name of POST_ONLY) {
    test(`POST ${name} is 404 in every spelling, and so is GET`, async ({ request }) => {
      for (const path of variants(name)) {
        expect((await request.post(path, { data: {} })).status(), `POST ${path}`).toBe(404);
        expect((await request.get(path)).status(), `GET ${path}`).toBe(404);
      }
    });
  }

  for (const name of GET_ONLY) {
    test(`GET ${name} is 404 in every spelling, and so is POST`, async ({ request }) => {
      for (const path of variants(name)) {
        expect((await request.get(path)).status(), `GET ${path}`).toBe(404);
        expect((await request.post(path, { data: {} })).status(), `POST ${path}`).toBe(404);
      }
    });
  }

  // Closed because the browser's own call cannot be made to revoke the person's other sessions; the
  // Account page's server action calls auth.api.changePassword instead (lib/change-password.db.test.ts).
  test("POST /change-password is 404 in every spelling, and so is GET", async ({ request }) => {
    for (const path of variantsAt("/api/auth/", "change-password")) {
      expect((await request.post(path, { data: {} })).status(), `POST ${path}`).toBe(404);
      expect((await request.get(path)).status(), `GET ${path}`).toBe(404);
    }
  });

  // Two-factor setup runs through the admin area's server actions, so the browser's own routes for it are
  // closed (lib/auth-closed-paths.ts, spec 0.7.1 8.2). Sign-in's two verify routes stay open.
  for (const name of ["enable", "disable", "get-totp-uri", "generate-backup-codes", "send-otp", "verify-otp"]) {
    test(`/two-factor/${name} is 404 in every spelling, GET and POST`, async ({ request }) => {
      for (const path of variantsAt("/api/auth/two-factor/", name)) {
        expect((await request.post(path, { data: {} })).status(), `POST ${path}`).toBe(404);
        expect((await request.get(path)).status(), `GET ${path}`).toBe(404);
      }
    });
  }

  // Passkey remove, rename and list are the Account actions' (lib/passkeys/change.ts); the four ceremonies stay open.
  for (const name of ["delete-passkey", "update-passkey", "list-user-passkeys"]) {
    test(`/passkey/${name} is 404 in every spelling, GET and POST`, async ({ request }) => {
      for (const path of variantsAt("/api/auth/passkey/", name)) {
        expect((await request.post(path, { data: {} })).status(), `POST ${path}`).toBe(404);
        expect((await request.get(path)).status(), `GET ${path}`).toBe(404);
      }
    });
  }

  test("the passkey sign-in ceremony is open without a session (a refusal, not a 404)", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": "10.77.0.10" } });
    try {
      expect((await anonymous.get("/api/auth/passkey/generate-authenticate-options")).status()).toBe(200);
      expect((await anonymous.post("/api/auth/passkey/verify-authentication", { data: { response: {} } })).status()).not.toBe(404);
    } finally {
      await anonymous.dispose();
    }
  });

  // Open for the sign-in challenge (answered with the two-factor cookie, no session). With a session they are
  // 404 (lib/auth-sign-in-only.ts): otherwise a stolen session could guess codes there, or turn two-factor
  // on from the browser past the app's own confirm. The `request` fixture is the signed-in test account.
  test("the two sign-in verify routes are 404 with a session, and open without one (a refusal, not a 404)", async ({ request, playwright, baseURL }) => {
    // A browser's own POST carries its Origin; without it Better Auth refuses a cookie-bearing request with 403 first.
    const headers = { origin: baseURL! };
    const anonymous = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": "10.77.0.9" } });
    try {
      for (const name of ["verify-totp", "verify-backup-code"]) {
        expect((await request.post(`/api/auth/two-factor/${name}`, { headers, data: { code: "000000" } })).status(), `${name} signed in`).toBe(404);
        expect((await anonymous.post(`/api/auth/two-factor/${name}`, { data: { code: "000000" } })).status(), `${name} signed out`).not.toBe(404);
      }
    } finally {
      await anonymous.dispose();
    }
  });

  test("what the app still uses is open: the session", async ({ request }) => {
    expect((await request.get("/api/auth/get-session")).status()).toBe(200);
  });

  // The active store is the app's own: only the switchStore action (after its access check) may move it (B4).
  test("switching stores through Better Auth is closed, and the session's active store cannot be written from the browser", async ({ request, baseURL }) => {
    const headers = { origin: baseURL! };
    expect((await request.post(`${BASE}set-active`, { headers, data: { organizationId: "anything" } })).status()).toBe(404);
    const write = await request.post("/api/auth/update-session", { headers, data: { activeStoreId: "anything" } });
    expect(write.status()).toBe(400);
    expect(await write.json()).toMatchObject({ code: "FIELD_NOT_ALLOWED" });
  });
});
