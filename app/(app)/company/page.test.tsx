// /company: it guards with requireCompanyPerson, reads only what the viewer's switches allow, and chooses the
// frame from who is asking (the shell's page for a person with a store, the bare page for company-only).

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCompanyPerson: vi.fn(),
  companyView: vi.fn(),
  recentChanges: vi.fn(),
}));
vi.mock("@/lib/companies/guard", () => ({ requireCompanyPerson: mocks.requireCompanyPerson }));
vi.mock("@/lib/companies/queries", () => ({ companyView: mocks.companyView }));
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
  regions: [{ id: "r1", name: "North", stores: 1, managers: 0 }],
  stores: [{ id: "s1", name: "Pioneer Place", regionId: "r1", regionName: "North", paused: false }],
};

beforeEach(() => {
  vi.clearAllMocks();
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
  });

  it("for a regional manager: read-only, no Recent changes read at all", async () => {
    mocks.requireCompanyPerson.mockResolvedValue({ kind: "member", user: USER, company: company("regional_manager", [], "North"), activeStoreId: "s1" });
    await draw();
    expect(screen.queryByLabelText("Company name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add region" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add store" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Recent changes" })).toBeNull();
    expect(mocks.recentChanges).not.toHaveBeenCalled();
    expect(screen.getByText("Regional Manager · North")).toBeInTheDocument();
  });

  it("for a company person with no store: the bare page, with Help and Sign out and no store to Open", async () => {
    mocks.requireCompanyPerson.mockResolvedValue({ kind: "company-only", user: USER, company: company("owner", ALL), activeStoreId: null });
    await draw();
    expect(document.querySelector("[data-shell-header]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
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
