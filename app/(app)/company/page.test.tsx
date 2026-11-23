// /company: it guards with requireCompanyPerson, reads only what the viewer's switches allow, and chooses the
// frame from who is asking (the shell's page for a person with a store, the bare page for company-only).

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCompanyPerson: vi.fn(),
  companyView: vi.fn(),
  recentChanges: vi.fn(),
  companyPeople: vi.fn(),
}));
vi.mock("@/lib/companies/guard", () => ({ requireCompanyPerson: mocks.requireCompanyPerson }));
vi.mock("@/lib/companies/queries", () => ({ companyView: mocks.companyView }));
vi.mock("@/lib/companies/people-read", async (original) => ({ ...(await original<typeof import("@/lib/companies/people-read")>()), companyPeople: mocks.companyPeople }));
vi.mock("@/app/(app)/company/people-actions", () => ({ inviteCompanyPersonAction: vi.fn(), cancelCompanyInvitationAction: vi.fn(), changeRegionAction: vi.fn(), removeCompanyPersonAction: vi.fn() }));
vi.mock("@/app/(app)/company/ownership-actions", () => ({ handOffOwnershipAction: vi.fn() }));
vi.mock("@/lib/companies/recent", () => ({ recentChanges: mocks.recentChanges }));
vi.mock("next/navigation", () => ({ usePathname: () => "/company", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(app)/company/actions", () => ({ renameCompanyAction: vi.fn(), addRegionAction: vi.fn(), renameRegionAction: vi.fn(), deleteRegionAction: vi.fn(), moveStoreAction: vi.fn() }));
vi.mock("@/app/(app)/company/store-actions", () => ({ addStoreAction: vi.fn() }));
vi.mock("@/app/(app)/switch-store-actions", () => ({ switchStore: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("@/components/shell/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <header data-shell-header>{title}</header> }));
vi.mock("@/components/corner-theme-toggle", () => ({ CornerThemeToggle: () => null }));

import CompanyPage from "./page";

const USER = { id: "u1", name: "Ana", email: "ana@example.com" };
const ALL = ["company.settings", "company.structure", "company.people"];
const company = (role: string, switches: string[], regionName: string | null = null) => ({ id: "c1", name: "Acme", role, regionId: regionName ? "r1" : null, regionName, switches });
const VIEW = {
  name: "Acme",
  ownerName: "Ana Owner",
  regions: [{ id: "r1", name: "North", version: 1, stores: 1, managers: 0 }],
  stores: [{ id: "s1", name: "Pioneer Place", regionId: "r1", regionName: "North", paused: false }],
};

const PEOPLE = {
  version: 3,
  invitations: [],
  people: [
    { userId: "u1", name: "Ana Owner", email: "ana@example.com", role: "owner", roleName: "Owner", regionId: null, regionName: null, version: 0, canAct: false },
    { userId: "u2", name: "Cy Admin", email: "cy@example.com", role: "corporate_admin", roleName: "Corporate Admin", regionId: null, regionName: null, version: 1, canAct: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.companyPeople.mockResolvedValue(PEOPLE);
  mocks.companyView.mockResolvedValue(VIEW);
  mocks.recentChanges.mockResolvedValue([{ id: "e1", text: "Ana added the region North", at: new Date("2026-11-22T20:00:00Z"), liminal: false }]);
});

async function draw() {
  render(await CompanyPage());
}

describe("/company", () => {
  it("for an owner in a store: the shell's header, every section and Recent changes", async () => {
    mocks.requireCompanyPerson.mockResolvedValue({ kind: "member", user: USER, company: company("owner", ALL), activeStoreId: "s1" });
    await draw();
    expect(screen.getByText("Acme", { selector: "header" })).toHaveAttribute("data-shell-header");
    for (const name of ["Details", "Regions", "Stores", "Recent changes"]) expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    expect(screen.getByLabelText("Company name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add region" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add store" })).toBeInTheDocument();
    expect(mocks.recentChanges).toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 2, name: "People" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Ownership" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hand off ownership" })).toBeInTheDocument();
  });

  it("for a corporate admin: People, but Ownership is the owner's alone", async () => {
    mocks.requireCompanyPerson.mockResolvedValue({ kind: "member", user: USER, company: company("corporate_admin", ALL), activeStoreId: "s1" });
    await draw();
    expect(screen.getByRole("heading", { level: 2, name: "People" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Ownership" })).toBeNull();
    // Below a corporate admin only regional managers can be invited, and the list is not read for the owner's section.
    expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument();
  });

  it("for a regional manager: read-only, no Recent changes read at all", async () => {
    mocks.requireCompanyPerson.mockResolvedValue({ kind: "member", user: USER, company: company("regional_manager", [], "North"), activeStoreId: "s1" });
    await draw();
    expect(screen.queryByLabelText("Company name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add region" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add store" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Recent changes" })).toBeNull();
    expect(mocks.recentChanges).not.toHaveBeenCalled();
    expect(mocks.companyPeople).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { level: 2, name: "People" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Ownership" })).toBeNull();
    expect(screen.getByText("Regional Manager · North")).toBeInTheDocument();
  });

  it("for a company person with no store: the bare page, with Help, Account and Sign out and no store to Open", async () => {
    mocks.requireCompanyPerson.mockResolvedValue({ kind: "company-only", user: USER, company: company("owner", ALL), activeStoreId: null });
    await draw();
    expect(document.querySelector("[data-shell-header]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    // The row still has its menu (Move to region, with company.structure) but no Open: there is no store to be in.
    await userEvent.setup().click(screen.getByRole("button", { name: "More for Pioneer Place" }));
    expect(screen.queryByRole("menuitem", { name: "Open" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Move to region" })).toBeInTheDocument();
  });

  it("lets the guard's redirect through (not signed in, no company role)", async () => {
    mocks.requireCompanyPerson.mockRejectedValue(new Error("redirect:/no-access"));
    await expect(CompanyPage()).rejects.toThrow("redirect:/no-access");
    expect(mocks.companyView).not.toHaveBeenCalled();
  });
});
