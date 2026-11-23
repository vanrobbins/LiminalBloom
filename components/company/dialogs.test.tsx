// The /company dialogs and the auto-saved name: what they send, what they say when the server refuses, and where
// they leave the person.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  addRegion: vi.fn(),
  deleteRegion: vi.fn(),
  renameRegion: vi.fn(),
  moveStore: vi.fn(),
  renameCompany: vi.fn(),
  addStore: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/app/(app)/company/actions", () => ({
  addRegionAction: mocks.addRegion,
  deleteRegionAction: mocks.deleteRegion,
  renameRegionAction: mocks.renameRegion,
  moveStoreAction: mocks.moveStore,
  renameCompanyAction: mocks.renameCompany,
}));
vi.mock("@/app/(app)/company/store-actions", () => ({ addStoreAction: mocks.addStore }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { CompanyNameForm } from "./company-name-form";
import { AddRegionDialog, DeleteRegionDialog, RenameRegionDialog } from "./region-dialogs";
import { AddStoreDialog, MoveStoreDialog } from "./store-dialogs";

const REGIONS = [
  { id: "r1", name: "North", stores: 0, managers: 0 },
  { id: "r2", name: "South", stores: 1, managers: 0 },
];
const shared = { opener: null, onClose: vi.fn(), regions: REGIONS };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddRegionDialog", () => {
  it("sends the name, then reloads the page's data and closes", async () => {
    mocks.addRegion.mockResolvedValue({ status: "saved", message: "Saved" });
    const user = userEvent.setup();
    render(<AddRegionDialog {...shared} />);
    expect(screen.getByRole("button", { name: "Add region" })).toBeDisabled();
    await user.type(screen.getByLabelText("Name"), "East");
    await user.click(screen.getByRole("button", { name: "Add region" }));
    expect(mocks.addRegion).toHaveBeenCalledWith("East");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(shared.onClose).toHaveBeenCalled();
  });

  it("says the server's refusal inside the dialog and stays open", async () => {
    mocks.addRegion.mockResolvedValue({ status: "refused", message: "There is already a region called East." });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddRegionDialog {...shared} onClose={onClose} />);
    await user.type(screen.getByLabelText("Name"), "East");
    await user.click(screen.getByRole("button", { name: "Add region" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("There is already a region called East.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("names a lost connection in the dialog, not in a toast", async () => {
    mocks.addRegion.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<AddRegionDialog {...shared} />);
    await user.type(screen.getByLabelText("Name"), "East");
    await user.click(screen.getByRole("button", { name: "Add region" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});

describe("RenameRegionDialog and DeleteRegionDialog", () => {
  it("rename sends the id, the new name and the name seen, and only once the name differs", async () => {
    mocks.renameRegion.mockResolvedValue({ status: "saved", message: "Saved" });
    const user = userEvent.setup();
    render(<RenameRegionDialog {...shared} region={REGIONS[0]} />);
    expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Northeast");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(mocks.renameRegion).toHaveBeenCalledWith("r1", "Northeast", "North");
  });

  it("delete of an empty region asks for the id", async () => {
    mocks.deleteRegion.mockResolvedValue({ status: "saved", message: "Saved" });
    const user = userEvent.setup();
    render(<DeleteRegionDialog {...shared} region={REGIONS[0]} />);
    await user.click(screen.getByRole("button", { name: "Delete region" }));
    expect(mocks.deleteRegion).toHaveBeenCalledWith("r1");
  });

  it("delete of a region still in use is refused in words when the server says so", async () => {
    mocks.deleteRegion.mockResolvedValue({ status: "refused", message: "Move this region's stores and regional managers first." });
    const user = userEvent.setup();
    // The page's counts were out of date: the dialog thought it empty.
    render(<DeleteRegionDialog {...shared} region={REGIONS[0]} />);
    await user.click(screen.getByRole("button", { name: "Delete region" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Move this region's stores and regional managers first.");
  });
});

describe("AddStoreDialog", () => {
  it("sends the name, a time zone and the chosen region (null for none), then goes to the new store's Home", async () => {
    mocks.addStore.mockResolvedValue({ status: "added", storeId: "s9", activeSet: true });
    const user = userEvent.setup();
    render(<AddStoreDialog {...shared} />);
    expect(screen.getByRole("button", { name: "Add store" })).toBeDisabled();
    await user.type(screen.getByLabelText("Store name"), "Outlet");
    await user.selectOptions(screen.getByLabelText("Region"), "r2");
    await user.click(screen.getByRole("button", { name: "Add store" }));
    expect(mocks.addStore).toHaveBeenCalledWith("Outlet", expect.any(String), "r2");
    expect(mocks.push).toHaveBeenCalledWith("/home");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("stays on the page, reloads it and says the store was added when the session could not move into it", async () => {
    mocks.addStore.mockResolvedValue({ status: "added", storeId: "s9", activeSet: false });
    const user = userEvent.setup();
    render(<AddStoreDialog {...shared} />);
    await user.type(screen.getByLabelText("Store name"), "Outlet");
    await user.click(screen.getByRole("button", { name: "Add store" }));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Store added" }));
    expect(shared.onClose).toHaveBeenCalled();
  });

  it("sends no region when none is chosen", async () => {
    mocks.addStore.mockResolvedValue({ status: "added", storeId: "s9", activeSet: true });
    const user = userEvent.setup();
    render(<AddStoreDialog {...shared} />);
    await user.type(screen.getByLabelText("Store name"), "Outlet");
    await user.click(screen.getByRole("button", { name: "Add store" }));
    expect(mocks.addStore).toHaveBeenCalledWith("Outlet", expect.any(String), null);
  });

  it("stays open and says why when the server refuses", async () => {
    mocks.addStore.mockResolvedValue({ status: "refused", message: "Could not add the store. Try again." });
    const user = userEvent.setup();
    render(<AddStoreDialog {...shared} />);
    await user.type(screen.getByLabelText("Store name"), "Outlet");
    await user.click(screen.getByRole("button", { name: "Add store" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not add the store. Try again.");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("MoveStoreDialog", () => {
  const store = { id: "s1", name: "Pioneer Place", regionId: "r1", regionName: "North", paused: false };

  it("starts on the store's region, and sends a changed one (null for No region)", async () => {
    mocks.moveStore.mockResolvedValue({ status: "saved", message: "Store moved" });
    const user = userEvent.setup();
    render(<MoveStoreDialog {...shared} store={store} />);
    expect(screen.getByLabelText("Region")).toHaveValue("r1");
    expect(screen.getByRole("button", { name: "Move store" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Region"), "No region");
    await user.click(screen.getByRole("button", { name: "Move store" }));
    expect(mocks.moveStore).toHaveBeenCalledWith("s1", null);
  });
});

describe("CompanyNameForm", () => {
  it("saves a valid changed name on blur, with the name it saw", async () => {
    mocks.renameCompany.mockResolvedValue({ status: "saved", message: "Company name saved" });
    const user = userEvent.setup();
    render(<CompanyNameForm name="Acme" />);
    await user.clear(screen.getByLabelText("Company name"));
    await user.type(screen.getByLabelText("Company name"), "Acme Corp");
    await user.tab();
    expect(mocks.renameCompany).toHaveBeenCalledWith("Acme Corp", "Acme");
  });

  it("sends nothing for an unchanged name, and says why for one that is too short", async () => {
    const user = userEvent.setup();
    render(<CompanyNameForm name="Acme" />);
    await user.click(screen.getByLabelText("Company name"));
    await user.tab();
    expect(mocks.renameCompany).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Company name"));
    await user.type(screen.getByLabelText("Company name"), "A");
    await user.tab();
    expect(mocks.renameCompany).not.toHaveBeenCalled();
    expect(screen.getByText("Give the company a name of 2 to 60 characters.")).toBeInTheDocument();
  });

  it("puts the stored name back and says why when the server refuses", async () => {
    mocks.renameCompany.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    render(<CompanyNameForm name="Acme" />);
    await user.clear(screen.getByLabelText("Company name"));
    await user.type(screen.getByLabelText("Company name"), "Acme Corp");
    await user.tab();
    expect(await screen.findByText("Changed on another device")).toBeInTheDocument();
    expect(screen.getByLabelText("Company name")).toHaveValue("Acme");
  });
});
