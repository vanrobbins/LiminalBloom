import { describe, expect, it } from "vitest";

import { CLOSED_PATHS } from "./auth-closed-paths";

describe("CLOSED_PATHS", () => {
  it("closes the six two-factor paths the app's own actions replace (spec 0.7.1 8.2)", () => {
    for (const name of ["enable", "disable", "get-totp-uri", "generate-backup-codes", "send-otp", "verify-otp"]) {
      expect(CLOSED_PATHS, name).toContain(`/two-factor/${name}`);
    }
  });
  it("leaves the two sign-in verifications open", () => {
    expect(CLOSED_PATHS).not.toContain("/two-factor/verify-totp");
    expect(CLOSED_PATHS).not.toContain("/two-factor/verify-backup-code");
  });
  it("closes the three passkey routes the app's own actions replace (remove, rename, list) and leaves the four ceremonies open (A3c)", () => {
    for (const name of ["delete-passkey", "update-passkey", "list-user-passkeys"]) expect(CLOSED_PATHS, name).toContain(`/passkey/${name}`);
    for (const name of ["generate-authenticate-options", "verify-authentication", "generate-register-options", "verify-registration"]) {
      expect(CLOSED_PATHS, name).not.toContain(`/passkey/${name}`);
    }
  });
  it("still closes change-password and the organization people routes, and leaves set-active alone", () => {
    expect(CLOSED_PATHS).toContain("/change-password");
    expect(CLOSED_PATHS).toContain("/organization/invite-member");
    expect(CLOSED_PATHS).not.toContain("/organization/set-active");
  });
});
