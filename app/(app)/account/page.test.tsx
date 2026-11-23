import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ person: vi.fn(), status: vi.fn(), standing: vi.fn(), card: vi.fn() }));

vi.mock("@/lib/current-member", () => ({ requireAccountPerson: mocks.person }));
vi.mock("@/lib/two-factor/status", () => ({ twoFactorStatus: mocks.status }));
vi.mock("@/lib/companies/request-reads", () => ({ standingCompanyOf: mocks.standing, requestCardFor: mocks.card }));
vi.mock("@/app/(app)/request-company/actions", () => ({ withdrawCompanyRequestAction: vi.fn() }));
vi.mock("./two-factor-actions", () => ({ startTwoFactorAction: vi.fn(), confirmTwoFactorAction: vi.fn(), newBackupCodesAction: vi.fn(), disableTwoFactorAction: vi.fn() }));
vi.mock("./passkey-actions", () => ({ allowPasskeyAddAction: vi.fn(), renamePasskeyAction: vi.fn(), removePasskeyAction: vi.fn() }));
vi.mock("./actions", () => ({ changePasswordAction: vi.fn() }));
vi.mock("@/components/shell/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn(), isSigningOut: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import AccountPage from "./page";

const USER = { id: "u", name: "Van", email: "v@x.co" };
const MEMBER = { kind: "member", user: USER, stores: [{ id: "a", name: "Pioneer Place" }], activeStoreId: "a" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.person.mockResolvedValue(MEMBER);
  mocks.standing.mockResolvedValue(null);
  mocks.card.mockResolvedValue(null);
  mocks.status.mockResolvedValue({ on: false, codesLeft: 0, isAdmin: false, requiredBy: null, passkeys: [] });
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

  it("has a Company card: Request a company with none, the company and role with one, a waiting request with Withdraw", async () => {
    const { unmount } = render(await AccountPage());
    expect(screen.getByRole("heading", { name: "Company" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a company" })).toHaveAttribute("href", "/request-company");
    unmount();
    mocks.standing.mockResolvedValue({ id: "c", name: "Acme", role: "corporate_admin" });
    const second = render(await AccountPage());
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open company" })).toHaveAttribute("href", "/company");
    expect(screen.getByRole("link", { name: "Request a new company" })).toBeInTheDocument();
    second.unmount();
    mocks.card.mockResolvedValue({ id: "r", name: "Globex", status: "pending", reason: null, thread: null });
    render(await AccountPage());
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request a new company" })).toBeNull();
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

  it("has the Passkeys card, with Add a passkey", async () => {
    render(await AccountPage());
    expect(screen.getByRole("heading", { name: /Passkeys/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a passkey" })).toBeInTheDocument();
  });

  it("shows a person whose stores are all paused their account in a bare frame: no store list, a way back and Sign out", async () => {
    mocks.person.mockResolvedValue({ kind: "paused", user: USER, stores: [{ id: "a", name: "Pioneer Place" }] });
    render(await AccountPage());
    expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Passkeys/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Two-step sign-in/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back/ })).toHaveAttribute("href", "/paused");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Store" })).toBeNull();
    expect(screen.queryByText("Pioneer Place")).toBeNull();
  });

  it("shows a company person with no store their account in the bare frame: the company and role, a way back to /company, no store list or Create a store", async () => {
    mocks.person.mockResolvedValue({ kind: "company-only", user: USER, company: { role: "owner" } });
    mocks.standing.mockResolvedValue({ id: "c", name: "Acme", role: "owner" });
    render(await AccountPage());
    expect(document.querySelector("[data-shell-header]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Passkeys/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Two-step sign-in/ })).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(/Owner/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open company" })).toHaveAttribute("href", "/company");
    expect(screen.getByRole("link", { name: /Back/ })).toHaveAttribute("href", "/company");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create a store" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open Store" })).toBeNull();
    expect(mocks.status).toHaveBeenCalledWith("u");
  });

  it("a person who must set up two-factor can add a passkey instead of an authenticator app", async () => {
    mocks.person.mockResolvedValue({ kind: "needs-two-factor", user: USER, roleName: "Store Manager" });
    render(await AccountPage());
    expect(screen.getByRole("button", { name: "Add a passkey" })).toBeInTheDocument();
  });
});
