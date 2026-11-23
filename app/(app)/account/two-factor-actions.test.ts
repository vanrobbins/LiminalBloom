// Account's two-step sign-in actions: each starts with the account guard (never a switch, never nothing), checks its
// input before asking anything, and carries the new session cookie to the browser when it turns on or off.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  person: vi.fn(),
  start: vi.fn(),
  confirm: vi.fn(),
  codes: vi.fn(),
  disable: vi.fn(),
  applyCookies: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "a=b" }) }));
vi.mock("@/lib/current-member", () => ({ requireAccountPerson: mocks.person }));
vi.mock("@/lib/two-factor/setup", () => ({ startTwoFactor: mocks.start, confirmTwoFactor: mocks.confirm, newBackupCodes: mocks.codes }));
vi.mock("@/lib/two-factor/disable", () => ({ disableTwoFactor: mocks.disable }));
vi.mock("@/lib/auth-cookies", () => ({ applyAuthCookies: mocks.applyCookies }));

import { confirmTwoFactorAction, disableTwoFactorAction, newBackupCodesAction, startTwoFactorAction } from "./two-factor-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.person.mockResolvedValue({ kind: "member", user: { id: "u1" } });
});

describe("the guard", () => {
  it("lets a person who must set up two-factor through (that is who calls these); a signed-out visitor never gets past it", async () => {
    mocks.person.mockResolvedValue({ kind: "needs-two-factor", user: { id: "u2" }, roleName: "Store Manager" });
    mocks.start.mockResolvedValue({ status: "started", otpauthUri: "otpauth://x", setupKey: "K", qrSvg: null, backupCodes: [] });
    expect((await startTwoFactorAction("pw-12345")).status).toBe("started");
    expect(mocks.start).toHaveBeenCalledWith(expect.any(Headers), "u2", "pw-12345");
    mocks.person.mockImplementation(async () => mocks.redirect("/sign-in"));
    for (const call of [() => startTwoFactorAction("pw"), () => confirmTwoFactorAction("123456"), () => newBackupCodesAction("pw"), () => disableTwoFactorAction("pw", "123456")]) {
      await expect(call()).rejects.toThrow("redirect:/sign-in");
    }
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.codes).not.toHaveBeenCalled();
    expect(mocks.disable).not.toHaveBeenCalled();
  });
});

describe("input", () => {
  it("refuses a missing, empty or over-long password or code before asking anything", async () => {
    for (const bad of [undefined, 5, "", "x".repeat(129)]) {
      expect(await startTwoFactorAction(bad)).toMatchObject({ status: "refused", message: "That isn't your password." });
      expect(await newBackupCodesAction(bad)).toMatchObject({ status: "refused" });
      expect(await disableTwoFactorAction(bad, "123456")).toMatchObject({ status: "refused", message: "That isn't your password." });
    }
    for (const bad of [undefined, "", "   ", "9".repeat(33)]) {
      expect(await confirmTwoFactorAction(bad)).toMatchObject({ status: "refused" });
      expect(await disableTwoFactorAction("pw-12345", bad)).toMatchObject({ status: "refused", message: "That code didn't work. Try the newest one." });
    }
    for (const m of [mocks.start, mocks.confirm, mocks.codes, mocks.disable]) expect(m).not.toHaveBeenCalled();
  });
});

describe("cookies", () => {
  it("turning on carries Better Auth's new session cookie to the browser; a wrong code carries none", async () => {
    const responseHeaders = new Headers({ "set-cookie": "better-auth.session_token=abc" });
    mocks.confirm.mockResolvedValueOnce({ status: "on", responseHeaders });
    expect(await confirmTwoFactorAction(" 123456 ")).toEqual({ status: "on" });
    expect(mocks.confirm).toHaveBeenCalledWith(expect.any(Headers), "u1", "123456");
    expect(mocks.applyCookies).toHaveBeenCalledWith(responseHeaders);
    mocks.applyCookies.mockClear();
    mocks.confirm.mockResolvedValueOnce({ status: "refused", reason: "code" });
    expect(await confirmTwoFactorAction("000000")).toMatchObject({ status: "refused" });
    expect(mocks.applyCookies).not.toHaveBeenCalled();
  });

  it("turning off carries the new session cookie too (Better Auth swaps the session), and passes the password and code", async () => {
    const responseHeaders = new Headers({ "set-cookie": "better-auth.session_token=def" });
    mocks.disable.mockResolvedValueOnce({ status: "off", responseHeaders });
    expect(await disableTwoFactorAction("pw-12345", " 654321 ")).toEqual({ status: "off" });
    expect(mocks.disable).toHaveBeenCalledWith(expect.any(Headers), "u1", "pw-12345", "654321");
    expect(mocks.applyCookies).toHaveBeenCalledWith(responseHeaders);
  });

  it("a refused turn off says why in words and sets no cookie, an admin's included", async () => {
    mocks.disable.mockResolvedValueOnce({ status: "refused", reason: "admin" });
    expect(await disableTwoFactorAction("pw-12345", "123456")).toEqual({ status: "refused", message: "Liminal Bloom admins need two-step sign-in, so it stays on." });
    expect(mocks.applyCookies).not.toHaveBeenCalled();
  });

  it("a turn off refused because the role requires it names the store", async () => {
    mocks.disable.mockResolvedValueOnce({ status: "refused", reason: "required", store: "Pioneer Place" });
    expect(await disableTwoFactorAction("pw-12345", "123456")).toEqual({ status: "refused", message: "Your role in Pioneer Place requires two-factor sign-in." });
    expect(mocks.applyCookies).not.toHaveBeenCalled();
  });
});
