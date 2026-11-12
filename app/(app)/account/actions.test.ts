// changePasswordAction with the guard, Better Auth and the cookie hand-off stood in:
// what is checked is what the action asks Better Auth for, and what it answers in words.

import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireMember: vi.fn(),
  changePassword: vi.fn(),
  applyAuthCookies: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "session=1" }) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { changePassword: mocks.changePassword } } }));
vi.mock("@/lib/auth-cookies", () => ({ applyAuthCookies: mocks.applyAuthCookies }));
vi.mock("@/lib/current-member", () => ({ requireMember: mocks.requireMember }));

import { changePasswordAction } from "./actions";

const OLD = "old-password-1";
const NEW = "new-password-2";
const answer = { headers: new Headers({ "set-cookie": "x=1" }), response: { token: "t" } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireMember.mockResolvedValue({ kind: "member" });
  mocks.changePassword.mockResolvedValue(answer);
});

describe("changePasswordAction", () => {
  it("asks Better Auth to change it and always to revoke the other sessions, with the request's headers, then hands over the new cookie", async () => {
    expect(await changePasswordAction(OLD, NEW, NEW)).toEqual({ status: "saved", message: "Password changed. Your other sessions were signed out." });
    expect(mocks.changePassword).toHaveBeenCalledTimes(1);
    const call = mocks.changePassword.mock.calls[0][0];
    expect(call.body).toEqual({ currentPassword: OLD, newPassword: NEW, revokeOtherSessions: true });
    expect(call.headers.get("cookie")).toBe("session=1");
    expect(call.returnHeaders).toBe(true);
    expect(mocks.applyAuthCookies).toHaveBeenCalledWith(answer.headers);
  });

  it("sends a signed-out visitor to sign in and changes nothing", async () => {
    mocks.requireMember.mockImplementation(async () => mocks.redirect("/sign-in"));
    await expect(changePasswordAction(OLD, NEW, NEW)).rejects.toThrow("redirect:/sign-in");
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("checks the person before it reads or changes anything", async () => {
    mocks.requireMember.mockRejectedValue(new Error("stop"));
    await expect(changePasswordAction(OLD, NEW, NEW)).rejects.toThrow("stop");
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it.each([
    [["", NEW, NEW], "current", "Enter your current password."],
    [[OLD, "short", "short"], "new", "Use at least 8 characters."],
    [[OLD, "x".repeat(129), "x".repeat(129)], "new", "Use at most 128 characters."],
    [[OLD, NEW, "different-password"], "confirm", "The two new passwords don't match."],
    [[OLD, OLD, OLD], "new", "Choose a password different from your current one."],
    [[1, NEW, NEW], "current", "Enter your current password."],
    [[OLD, null, null], "new", "Use at least 8 characters."],
  ] as const)("refuses %j in words without calling Better Auth", async (args, field, message) => {
    expect(await changePasswordAction(...(args as [unknown, unknown, unknown]))).toEqual({ status: "refused", field, message });
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("a wrong current password is said next to that field, and no cookie is touched", async () => {
    mocks.changePassword.mockRejectedValue(new APIError("BAD_REQUEST", { message: "Invalid password", code: "INVALID_PASSWORD" }));
    expect(await changePasswordAction(OLD, NEW, NEW)).toEqual({ status: "refused", field: "current", message: "That isn't your current password." });
    expect(mocks.applyAuthCookies).not.toHaveBeenCalled();
  });

  it("any other failure is a plain 'try again', never Better Auth's message", async () => {
    mocks.changePassword.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));
    expect(await changePasswordAction(OLD, NEW, NEW)).toEqual({ status: "refused", message: "Couldn't change the password. Try again." });
    mocks.changePassword.mockRejectedValue(new APIError("INTERNAL_SERVER_ERROR", { message: "secret detail" }));
    expect(await changePasswordAction(OLD, NEW, NEW)).toEqual({ status: "refused", message: "Couldn't change the password. Try again." });
  });
});
