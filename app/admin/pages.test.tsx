// /admin/two-factor and /admin/verify choose what to show from the admin's own state; the guards
// are stood in for (lib/admin/guard.db.test.ts proves them), redirect() throws as Next's does.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ account: vi.fn(), full: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/admin/guard", () => ({ requirePlatformAdminAccount: mocks.account, requirePlatformAdmin: mocks.full }));
vi.mock("./two-factor/actions", () => ({ startTwoFactorAction: vi.fn(), confirmTwoFactorAction: vi.fn() }));
vi.mock("./two-factor/codes-actions", () => ({ newBackupCodesAction: vi.fn() }));
vi.mock("./verify/actions", () => ({ verifyAdminCodeAction: vi.fn(), dropReplacedSessionAction: vi.fn() }));

import TwoFactorPage from "./two-factor/page";
import VerifyPage from "./verify/page";

const account = (over: object) => ({ userId: "u1", sessionId: "s1", name: "Van", email: "v@example.com", twoFactorEnabled: false, passkey: false, twoFactorAt: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.full.mockResolvedValue(account({}));
});

describe("/admin/two-factor", () => {
  it("shows setup to an admin without two-step sign-in, needing only the account guard", async () => {
    mocks.account.mockResolvedValue(account({ twoFactorEnabled: false }));
    render(await TwoFactorPage());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Turn on two-step sign-in");
    expect(mocks.full).not.toHaveBeenCalled();
  });
  it("says it is on, with New backup codes, to one who has it and a fresh code", async () => {
    mocks.account.mockResolvedValue(account({ twoFactorEnabled: true }));
    render(await TwoFactorPage());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Two-step sign-in is on");
    expect(screen.getByRole("button", { name: "New backup codes" })).toBeInTheDocument();
  });
  it("sends one who has it but a stale code to the step-up (the full guard decides)", async () => {
    mocks.account.mockResolvedValue(account({ twoFactorEnabled: true }));
    mocks.full.mockRejectedValue(new Error("redirect:/admin/verify"));
    await expect(TwoFactorPage()).rejects.toThrow("redirect:/admin/verify");
  });
});

describe("/admin/verify", () => {
  it("asks for the code when the last one is missing or old", async () => {
    mocks.account.mockResolvedValue(account({ twoFactorEnabled: true, twoFactorAt: new Date(Date.now() - 13 * 3_600_000) }));
    render(await VerifyPage());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Confirm it's you");
  });
  it("sends an admin without two-step sign-in to set it up", async () => {
    mocks.account.mockResolvedValue(account({ twoFactorEnabled: false }));
    await expect(VerifyPage()).rejects.toThrow("redirect:/admin/two-factor");
  });
  it("sends an admin whose code is fresh on to /admin", async () => {
    mocks.account.mockResolvedValue(account({ twoFactorEnabled: true, twoFactorAt: new Date() }));
    await expect(VerifyPage()).rejects.toThrow("redirect:/admin");
  });
  it("offers only Use a passkey to an admin whose second factor is a passkey (A3c), and both to one with both", async () => {
    mocks.account.mockResolvedValue(account({ passkey: true }));
    const { unmount } = render(await VerifyPage());
    expect(screen.getByRole("button", { name: "Use a passkey" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Code from your authenticator app")).toBeNull();
    unmount();
    mocks.account.mockResolvedValue(account({ passkey: true, twoFactorEnabled: true }));
    render(await VerifyPage());
    expect(screen.getByRole("button", { name: "Use a passkey" })).toBeInTheDocument();
    expect(screen.getByLabelText("Code from your authenticator app")).toBeInTheDocument();
  });
  it("an admin with an authenticator app and no passkey is not offered one", async () => {
    mocks.account.mockResolvedValue(account({ twoFactorEnabled: true }));
    render(await VerifyPage());
    expect(screen.queryByRole("button", { name: "Use a passkey" })).toBeNull();
  });
});
