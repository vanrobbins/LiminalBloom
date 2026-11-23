import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ person: vi.fn(), status: vi.fn() }));

vi.mock("@/lib/current-member", () => ({ requireAccountPerson: mocks.person }));
vi.mock("@/lib/two-factor/status", () => ({ twoFactorStatus: mocks.status }));
vi.mock("./two-factor-actions", () => ({ startTwoFactorAction: vi.fn(), confirmTwoFactorAction: vi.fn(), newBackupCodesAction: vi.fn(), disableTwoFactorAction: vi.fn() }));
vi.mock("./actions", () => ({ changePasswordAction: vi.fn() }));
vi.mock("@/components/shell/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn(), isSigningOut: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import AccountPage from "./page";

const USER = { id: "u", name: "Van", email: "v@x.co" };
const MEMBER = { kind: "member", user: USER, stores: [{ id: "a", name: "Pioneer Place" }], activeStoreId: "a" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.person.mockResolvedValue(MEMBER);
  mocks.status.mockResolvedValue({ on: false, codesLeft: 0, isAdmin: false });
});

describe("AccountPage", () => {
  it("offers Create a store to someone in one store", async () => {
    render(await AccountPage());
    expect(screen.getByRole("link", { name: "Create a store" })).toHaveAttribute("href", "/create-store");
  });

  it("hides the internal user id and links the working store's panel", async () => {
    render(await AccountPage());
    expect(screen.queryByText("User id")).toBeNull();
    expect(screen.getByRole("link", { name: "Open Store" })).toHaveAttribute("href", "/store");
  });

  it("has the Change password card", async () => {
    render(await AccountPage());
    expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
  });

  it("has the Two-step sign-in card, off, with Turn on; its status is read for the signed-in person", async () => {
    render(await AccountPage());
    expect(screen.getByRole("heading", { name: /Two-step sign-in/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn on" })).toBeInTheDocument();
    expect(mocks.status).toHaveBeenCalledWith("u");
  });

  it("shows only the setup and Sign out to a person whose role needs two-step sign-in and who has none (no redirect to itself)", async () => {
    mocks.person.mockResolvedValue({ kind: "needs-two-factor", user: USER, roleName: "Store Manager" });
    render(await AccountPage());
    expect(screen.getByText(/Your role, Store Manager, needs two-step sign-in/)).toBeInTheDocument();
    expect(screen.getByLabelText("Password", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Change password" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Create a store" })).toBeNull();
    expect(mocks.status).not.toHaveBeenCalled();
  });
});
