import { describe, expect, it } from "vitest";

import { passkeyRelyingParty, SECOND_FACTOR_PATHS, twoFactorAtFor } from "./auth-factors";

const NOW = new Date("2026-11-23T12:00:00Z");

describe("twoFactorAtFor", () => {
  it("is now for the endpoints that prove a second factor", () => {
    for (const path of ["/two-factor/verify-totp", "/two-factor/verify-backup-code", "/passkey/verify-authentication"]) {
      expect(twoFactorAtFor(path, NOW), path).toEqual(NOW);
    }
  });

  it("is null for every other way a session starts", () => {
    // /passkey/verify-registration can create a session too; it proves a new key, not the person.
    for (const path of ["/sign-in/email", "/sign-up/email", "/passkey/verify-registration", "/two-factor/enable", "/two-factor/verify-otp", "", undefined]) {
      expect(twoFactorAtFor(path, NOW), String(path)).toBeNull();
    }
  });

  it("matches the path exactly, not by prefix or case", () => {
    expect(twoFactorAtFor("/two-factor/verify-totp/extra", NOW)).toBeNull();
    expect(twoFactorAtFor("/Two-Factor/verify-totp", NOW)).toBeNull();
    expect(SECOND_FACTOR_PATHS).toHaveLength(3);
  });
});

describe("passkeyRelyingParty", () => {
  it("takes the rpID from the hostname of BETTER_AUTH_URL, and the origin from its origin", () => {
    expect(passkeyRelyingParty("http://localhost:3000")).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
    expect(passkeyRelyingParty("https://liminalbloom.app/")).toEqual({ rpID: "liminalbloom.app", origin: "https://liminalbloom.app" });
    expect(passkeyRelyingParty("https://liminalbloom.vanar.me/some/path")).toEqual({ rpID: "liminalbloom.vanar.me", origin: "https://liminalbloom.vanar.me" });
  });

  it("keeps the port out of the rpID but in the origin", () => {
    expect(passkeyRelyingParty("https://liminalbloom.app:8443")).toEqual({ rpID: "liminalbloom.app", origin: "https://liminalbloom.app:8443" });
  });

  it("leaves both to Better Auth when the URL is missing or not a URL", () => {
    expect(passkeyRelyingParty(undefined)).toEqual({});
    expect(passkeyRelyingParty("not a url")).toEqual({});
  });
});
