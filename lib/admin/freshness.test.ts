import { describe, expect, it } from "vitest";

import { ADMIN_FRESH_MS, adminStanding, isFresh } from "./freshness";

const NOW = new Date("2026-11-23T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const HOUR = 3_600_000;

describe("isFresh (the 12-hour rule, spec 0.7.1 7.2)", () => {
  it("is 12 hours", () => expect(ADMIN_FRESH_MS).toBe(12 * HOUR));
  it("passes a code entered a moment ago and one just inside 12 hours", () => {
    expect(isFresh(ago(0), NOW)).toBe(true);
    expect(isFresh(ago(12 * HOUR), NOW)).toBe(true);
  });
  it("fails one a millisecond past 12 hours, a missing one, and one from the future", () => {
    expect(isFresh(ago(12 * HOUR + 1), NOW)).toBe(false);
    expect(isFresh(null, NOW)).toBe(false);
    expect(isFresh(undefined, NOW)).toBe(false);
    expect(isFresh(new Date(NOW.getTime() + 10 * 60_000), NOW)).toBe(false);
  });
});

describe("adminStanding", () => {
  const admin = { signedIn: true, isAdmin: true, twoFactorEnabled: true, twoFactorAt: ago(HOUR) };
  it("walks the table in order: signed out, not an admin, no two-factor, stale, ok", () => {
    expect(adminStanding({ ...admin, signedIn: false }, NOW)).toBe("signed-out");
    expect(adminStanding({ ...admin, isAdmin: false }, NOW)).toBe("not-admin");
    expect(adminStanding({ ...admin, twoFactorEnabled: false }, NOW)).toBe("needs-two-factor");
    expect(adminStanding({ ...admin, twoFactorAt: ago(13 * HOUR) }, NOW)).toBe("needs-verify");
    expect(adminStanding({ ...admin, twoFactorAt: null }, NOW)).toBe("needs-verify");
    expect(adminStanding(admin, NOW)).toBe("ok");
  });
  it("answers an account that is not an admin the same whatever its factor state (nothing is leaked)", () => {
    expect(adminStanding({ ...admin, isAdmin: false, twoFactorEnabled: false, twoFactorAt: null }, NOW)).toBe("not-admin");
  });
});
