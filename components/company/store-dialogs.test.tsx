// The store dialogs on /company (add a store, move a store between regions): what they send, what they say when the server refuses, and where they leave the person.

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

import { AddStoreDialog, MoveStoreDialog } from "./store-dialogs";


const REGIONS = [
  { id: "r1", name: "North", version: 1, stores: 0, managers: 0 },
  { id: "r2", name: "South", version: 1, stores: 1, managers: 0 },
];
const shared = { opener: null, onClose: vi.fn(), regions: REGIONS };

beforeEach(() => {
  vi.clearAllMocks();
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
