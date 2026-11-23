// The admin setup, codes and step-up actions: refused without their guard, nothing reaches Better Auth
// unguarded, input is checked, and the confirm carries the new session cookie to the browser.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  full: vi.fn(),
  start: vi.fn(),
  confirm: vi.fn(),
  codes: vi.fn(),
  stepUp: vi.fn(),
  applyCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "a=b" }) }));
vi.mock("@/lib/admin/guard", () => ({ requirePlatformAdminAccountForAction: mocks.account, requirePlatformAdminForAction: mocks.full }));
vi.mock("@/lib/two-factor/setup", () => ({ startTwoFactor: mocks.start, confirmTwoFactor: mocks.confirm, newBackupCodes: mocks.codes }));
vi.mock("@/lib/admin/step-up", () => ({ verifyAdminCode: mocks.stepUp }));
vi.mock("@/lib/auth-cookies", () => ({ applyAuthCookies: mocks.applyCookies }));

import { verifyAdminCodeAction } from "../verify/actions";
import { confirmTwoFactorAction, startTwoFactorAction } from "./actions";
import { newBackupCodesAction } from "./codes-actions";

const ADMIN = { userId: "u1", sessionId: "s1", name: "Van", email: "van@example.com", twoFactorEnabled: true, twoFactorAt: null };
const ok = { status: "ok", admin: ADMIN };
const forbidden = { status: "forbidden" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.mockResolvedValue(ok);
  mocks.full.mockResolvedValue(ok);
});

describe("startTwoFactorAction", () => {
  it("is refused for a non-admin and never reaches Better Auth", async () => {
    mocks.account.mockResolvedValue(forbidden);
    expect(await startTwoFactorAction("password-1")).toMatchObject({ status: "refused" });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("refuses a missing, empty or over-long password before asking anything", async () => {
    for (const bad of [undefined, 5, "", "x".repeat(129)]) expect(await startTwoFactorAction(bad)).toMatchObject({ status: "refused", message: "That isn't your password." });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("passes the account's id and the request headers, and returns the setup details", async () => {
    mocks.start.mockResolvedValue({ status: "started", otpauthUri: "otpauth://x", setupKey: "KEY", backupCodes: ["a"] });
    expect(await startTwoFactorAction("password-1")).toEqual({ status: "started", otpauthUri: "otpauth://x", setupKey: "KEY", backupCodes: ["a"] });
    expect(mocks.start).toHaveBeenCalledWith(expect.any(Headers), "u1", "password-1");
  });
  it("turns a refusal into its words", async () => {
    mocks.start.mockResolvedValue({ status: "refused", reason: "locked" });
    expect(await startTwoFactorAction("password-1")).toEqual({ status: "refused", message: "Too many tries. Try again in a few minutes." });
  });
});

describe("confirmTwoFactorAction", () => {
  it("is refused for a non-admin", async () => {
    mocks.account.mockResolvedValue(forbidden);
    expect(await confirmTwoFactorAction("123456")).toMatchObject({ status: "refused" });
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("carries Better Auth's new session cookie to the browser when it turns on", async () => {
    const responseHeaders = new Headers({ "set-cookie": "better-auth.session_token=abc" });
    mocks.confirm.mockResolvedValue({ status: "on", responseHeaders });
    expect(await confirmTwoFactorAction(" 123456 ")).toEqual({ status: "on" });
    expect(mocks.confirm).toHaveBeenCalledWith(expect.any(Headers), "u1", "123456");
    expect(mocks.applyCookies).toHaveBeenCalledWith(responseHeaders);
  });
  it("applies no cookie when the code is wrong", async () => {
    mocks.confirm.mockResolvedValue({ status: "refused", reason: "code" });
    expect(await confirmTwoFactorAction("000000")).toEqual({ status: "refused", message: "That code didn't work. Try the newest one." });
    expect(mocks.applyCookies).not.toHaveBeenCalled();
  });
  it("refuses a non-string or over-long code without asking", async () => {
    for (const bad of [undefined, "", "   ", "9".repeat(33)]) expect(await confirmTwoFactorAction(bad)).toMatchObject({ status: "refused" });
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});

describe("newBackupCodesAction", () => {
  it("needs the full admin guard, not the account one", async () => {
    mocks.full.mockResolvedValue(forbidden);
    expect(await newBackupCodesAction("password-1")).toMatchObject({ status: "refused" });
    expect(mocks.codes).not.toHaveBeenCalled();
    expect(mocks.account).not.toHaveBeenCalled();
  });
  it("returns the new codes", async () => {
    mocks.codes.mockResolvedValue({ status: "codes", backupCodes: ["a", "b"] });
    expect(await newBackupCodesAction("password-1")).toEqual({ status: "codes", backupCodes: ["a", "b"] });
    expect(mocks.codes).toHaveBeenCalledWith(expect.any(Headers), "u1", "password-1");
  });
});

describe("verifyAdminCodeAction", () => {
  it("is refused for a non-admin", async () => {
    mocks.account.mockResolvedValue(forbidden);
    expect(await verifyAdminCodeAction("123456")).toMatchObject({ status: "refused" });
    expect(mocks.stepUp).not.toHaveBeenCalled();
  });
  it("is refused while two-factor is not on, without asking Better Auth", async () => {
    mocks.account.mockResolvedValue({ status: "ok", admin: { ...ADMIN, twoFactorEnabled: false } });
    expect(await verifyAdminCodeAction("123456")).toEqual({ status: "refused", message: "Two-step sign-in isn't on yet." });
    expect(mocks.stepUp).not.toHaveBeenCalled();
  });
  it("marks this session: passes the account id and the session id, and answers ok", async () => {
    mocks.stepUp.mockResolvedValue({ status: "ok" });
    expect(await verifyAdminCodeAction("123456")).toEqual({ status: "ok" });
    expect(mocks.stepUp).toHaveBeenCalledWith(expect.any(Headers), "u1", "s1", "123456");
  });
  it("a locked or wrong answer becomes words", async () => {
    mocks.stepUp.mockResolvedValue({ status: "refused", reason: "locked" });
    expect(await verifyAdminCodeAction("123456")).toEqual({ status: "refused", message: "Too many tries. Try again in a few minutes." });
  });
});
