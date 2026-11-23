// Each /company section shows a control only when its company switch (or its being in a store) allows it.
// The server checks again on every action (app/(app)/company/actions.test.ts); this is the courtesy.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), switchStore: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/app/(app)/switch-store-actions", () => ({ switchStore: mocks.switchStore }));
vi.mock("@/app/(app)/company/actions", () => ({ renameCompanyAction: vi.fn(), addRegionAction: vi.fn(), renameRegionAction: vi.fn(), deleteRegionAction: vi.fn(), moveStoreAction: vi.fn() }));
vi.mock("@/app/(app)/company/store-actions", () => ({ addStoreAction: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

import type { CompanyStoreRow, RegionRow } from "@/lib/companies/queries";

import { DetailsSection } from "./details-section";
import { RecentSection } from "./recent-section";
import { RegionsSection } from "./regions-section";
import { StoresSection } from "./stores-section";

const REGIONS: RegionRow[] = [
  { id: "r1", name: "North", stores: 2, managers: 1 },
  { id: "r2", name: "South", stores: 0, managers: 0 },
];
const STORES: CompanyStoreRow[] = [
  { id: "s1", name: "Pioneer Place", regionId: "r1", regionName: "North", paused: false },
  { id: "s2", name: "Washington Square", regionId: "r1", regionName: "North", paused: true },
  { id: "s3", name: "Outlet", regionId: null, regionName: null, paused: false },
];

describe("DetailsSection", () => {
  const props = { name: "Acme", ownerName: "Ana Owner", roleName: "Corporate Admin", regionName: null };

  it("with company.settings, the name is a field that saves as it changes", () => {
    render(<DetailsSection {...props} canRename />);
    expect(screen.getByLabelText("Company name")).toHaveValue("Acme");
    expect(screen.queryByText("Your role can't change the company's name.")).toBeNull();
  });

  it("without it, the name is read-only and says why", () => {
    render(<DetailsSection {...props} canRename={false} />);
    expect(screen.queryByLabelText("Company name")).toBeNull();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Your role can't change the company's name.")).toBeInTheDocument();
  });

  it("names the owner and the viewer's role, with the region for a regional manager", () => {
    render(<DetailsSection {...props} roleName="Regional Manager" regionName="North" canRename={false} />);
    expect(screen.getByText("Ana Owner")).toBeInTheDocument();
    expect(screen.getByText("Regional Manager · North")).toBeInTheDocument();
  });
});

describe("RegionsSection", () => {
  it("with company.structure: Add region and a menu on each row, counts in words", () => {
    render(<RegionsSection regions={REGIONS} canEdit />);
    expect(screen.getByRole("button", { name: "Add region" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More for North" })).toBeInTheDocument();
    expect(screen.getByText(/2 stores · 1 regional manager$/)).toBeInTheDocument();
    expect(screen.getByText(/0 stores · 0 regional managers$/)).toBeInTheDocument();
  });

  it("without it: rows only, no Add and no menu", () => {
    render(<RegionsSection regions={REGIONS} canEdit={false} />);
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add region" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^More for/ })).toBeNull();
  });

  it("offers Rename and Delete in a row's menu, and Delete of a region in use explains and cannot be confirmed", async () => {
    const user = userEvent.setup();
    render(<RegionsSection regions={REGIONS} canEdit />);
    await user.click(screen.getByRole("button", { name: "More for North" }));
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete North?" });
    expect(within(dialog).getByText("Move North's stores and regional managers first.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete region" })).toBeDisabled();
  });

  it("lets an empty region be deleted", async () => {
    const user = userEvent.setup();
    render(<RegionsSection regions={REGIONS} canEdit />);
    await user.click(screen.getByRole("button", { name: "More for South" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(await screen.findByRole("button", { name: "Delete region" })).toBeEnabled();
  });
});

describe("StoresSection", () => {
  it("groups stores by region then No region, with counts", () => {
    render(<StoresSection stores={STORES} regions={REGIONS} canEdit activeStoreId="s1" />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["North · 2", "No region · 1"]);
  });

  it("with company.structure: Add store, and Move to region in a row's menu", async () => {
    const user = userEvent.setup();
    render(<StoresSection stores={STORES} regions={REGIONS} canEdit activeStoreId="s1" />);
    expect(screen.getByRole("button", { name: "Add store" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More for Outlet" }));
    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Move to region" })).toBeInTheDocument();
  });

  it("without it: no Add store and no Move to region, but Open stays", async () => {
    const user = userEvent.setup();
    render(<StoresSection stores={STORES} regions={REGIONS} canEdit={false} activeStoreId="s1" />);
    expect(screen.queryByRole("button", { name: "Add store" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "More for Outlet" }));
    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Move to region" })).toBeNull();
  });

  it("a paused store says so and is not offered Open", () => {
    render(<StoresSection stores={STORES} regions={REGIONS} canEdit={false} activeStoreId="s1" />);
    expect(screen.getByText(/Paused by Liminal Bloom/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More for Washington Square" })).toBeNull();
  });

  it("with no store of their own to be in, a company person has no Open", () => {
    render(<StoresSection stores={STORES} regions={REGIONS} canEdit={false} activeStoreId={null} />);
    expect(screen.queryByRole("button", { name: /^More for/ })).toBeNull();
  });

  it("Open switches to the store and goes to its Home; the active store only goes", async () => {
    mocks.switchStore.mockResolvedValue({ status: "switched" });
    const user = userEvent.setup();
    render(<StoresSection stores={STORES} regions={REGIONS} canEdit={false} activeStoreId="s1" />);
    await user.click(screen.getByRole("button", { name: "More for Outlet" }));
    await user.click(screen.getByRole("menuitem", { name: "Open" }));
    expect(mocks.switchStore).toHaveBeenCalledWith("s3");
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));

    mocks.switchStore.mockClear();
    mocks.push.mockClear();
    await user.click(screen.getByRole("button", { name: "More for Pioneer Place" }));
    await user.click(screen.getByRole("menuitem", { name: "Open" }));
    expect(mocks.switchStore).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
  });

  it("says so when there are no stores", () => {
    render(<StoresSection stores={[]} regions={[]} canEdit activeStoreId={null} />);
    expect(screen.getByText("No stores yet. Add the first one.")).toBeInTheDocument();
  });
});

describe("RecentSection", () => {
  it("lists the lines as given, and says so when empty", () => {
    const at = new Date("2026-11-22T20:00:00Z");
    const { unmount } = render(
      <RecentSection
        changes={[
          { id: "1", text: "Ana added the region North", at, liminal: false },
          { id: "2", text: "Liminal Bloom paused Acme: billing", at, liminal: true },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Ana added the region North");
    expect(items[1]).toHaveTextContent("Liminal Bloom paused Acme: billing");
    unmount();
    render(<RecentSection changes={[]} />);
    expect(screen.getByText("Nothing has changed yet.")).toBeInTheDocument();
  });
});
