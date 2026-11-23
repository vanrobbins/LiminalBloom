import { describe, expect, it } from "vitest";

import { twoFactorRefusal } from "./sign-in-refusal";

describe("twoFactorRefusal (spec 0.7.1 8.3 sign-in, the three refusals)", () => {
  it("a wrong authenticator code says to try the newest one", () => {
    expect(twoFactorRefusal({ status: 401, code: "INVALID_CODE" }, "totp")).toEqual({ message: "That code didn't work. Try the newest one.", restart: false });
  });
  it("a wrong backup code says each works once", () => {
    expect(twoFactorRefusal({ status: 401, code: "INVALID_BACKUP_CODE" }, "backup")).toEqual({ message: "That backup code didn't work. Each one works only once.", restart: false });
  });
  it("a locked account says 15 minutes and offers the way back to sign-in", () => {
    expect(twoFactorRefusal({ status: 429, code: "ACCOUNT_TEMPORARILY_LOCKED" }, "totp")).toEqual({ message: "Too many tries. Sign in again in 15 minutes.", restart: true });
  });
  it("five wrong tries on one sign-in end it", () => {
    expect(twoFactorRefusal({ status: 400, code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" }, "totp")).toEqual({ message: "Too many tries. Sign in again.", restart: true });
  });
  it("a missing or old challenge says the sign-in timed out", () => {
    expect(twoFactorRefusal({ status: 401, code: "INVALID_TWO_FACTOR_COOKIE" }, "totp")).toEqual({ message: "This sign-in timed out. Sign in again.", restart: true });
  });
  it("the rate limit (429, no code) says to wait a moment and keeps the form", () => {
    expect(twoFactorRefusal({ status: 429 }, "totp")).toEqual({ message: "Too many tries. Wait a few seconds, then try again.", restart: false });
  });
  it("anything unknown is treated as a wrong code", () => {
    expect(twoFactorRefusal({ status: 500 }, "totp").message).toBe("That code didn't work. Try the newest one.");
    expect(twoFactorRefusal({}, "totp").restart).toBe(false);
  });
});
