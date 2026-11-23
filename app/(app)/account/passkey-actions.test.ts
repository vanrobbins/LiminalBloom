// Account's passkey actions: each starts with the account guard, checks its input before asking anything, and
// words a refusal (the last-passkey one names the store).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  person: vi.fn(),
  allow: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "a=b" }) }));
vi.mock("@/lib/current-member", () => ({ requireAccountPerson: mocks.person }));
vi.mock("@/lib/passkeys/change", () => ({ allowPasskeyAdd: mocks.allow, renamePasskey: mocks.rename, removePasskey: mocks.remove }));

import { allowPasskeyAddAction, removePasskeyAction, renamePasskeyAction } from "./passkey-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.person.mockResolvedValue({ kind: "member", user: { id: "u1" } });
});

describe("the guard", () => {
  it("lets a person who must set up two-factor through (a passkey counts); a signed-out visitor never gets past it", async () => {
    mocks.person.mockResolvedValue({ kind: "needs-two-factor", user: { id: "u2" }, roleName: "Store Manager" });
    mocks.allow.mockResolvedValue({ status: "ok" });
    expect(await allowPasskeyAddAction("pw-12345")).toEqual({ status: "ok" });
    expect(mocks.allow).toHaveBeenCalledWith(expect.any(Headers), "u2", "pw-12345");
    mocks.person.mockImplementation(async () => mocks.redirect("/sign-in"));
    for (const call of [() => allowPasskeyAddAction("pw"), () => renamePasskeyAction("k1", "Name"), () => removePasskeyAction("k1", "pw")]) {
      await expect(call()).rejects.toThrow("redirect:/sign-in");
    }
    expect(mocks.allow).toHaveBeenCalledTimes(1);
    expect(mocks.rename).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

describe("input is checked before anything is asked", () => {
  it("refuses a missing, empty or huge password and a missing id without calling the library", async () => {
    expect((await allowPasskeyAddAction(undefined)).status).toBe("refused");
    expect((await allowPasskeyAddAction("")).status).toBe("refused");
    expect((await removePasskeyAction("k1", "x".repeat(5000))).status).toBe("refused");
    expect((await removePasskeyAction(7, "pw")).status).toBe("refused");
    expect((await renamePasskeyAction(undefined, "Name")).status).toBe("refused");
    expect((await renamePasskeyAction("k1", 5)).status).toBe("refused");
    expect(mocks.allow).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rename).not.toHaveBeenCalled();
  });
});

describe("the work and its refusals", () => {
  it("passes the person's own id, never one from the browser", async () => {
    mocks.rename.mockResolvedValue({ status: "ok" });
    mocks.remove.mockResolvedValue({ status: "ok" });
    expect(await renamePasskeyAction("k1", "Phone")).toEqual({ status: "ok" });
    expect(mocks.rename).toHaveBeenCalledWith("u1", "k1", "Phone");
    expect(await removePasskeyAction("k1", "pw-12345")).toEqual({ status: "ok" });
    expect(mocks.remove).toHaveBeenCalledWith(expect.any(Headers), "u1", "k1", "pw-12345");
  });

  it("words a wrong password, and the last passkey with the store that requires it", async () => {
    mocks.remove.mockResolvedValueOnce({ status: "refused", reason: "password" });
    expect(await removePasskeyAction("k1", "nope")).toEqual({ status: "refused", message: "That isn't your password." });
    mocks.remove.mockResolvedValueOnce({ status: "refused", reason: "last", store: "Pioneer Place" });
    expect(await removePasskeyAction("k1", "pw")).toEqual({ status: "refused", message: "Your role in Pioneer Place requires two-factor sign-in, and this is your only passkey." });
    mocks.remove.mockResolvedValueOnce({ status: "refused", reason: "last" });
    expect(await removePasskeyAction("k1", "pw")).toEqual({ status: "refused", message: "This is your only passkey, and you need it to sign in with two steps." });
  });
});
