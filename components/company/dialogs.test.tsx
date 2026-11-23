// The region dialogs on /company: what they send, what they say when the server refuses, and where they leave the person.

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

import { AddRegionDialog, DeleteRegionDialog, RenameRegionDialog } from "./region-dialogs";


const REGIONS = [
  { id: "r1", name: "North", version: 1, stores: 0, managers: 0 },
  { id: "r2", name: "South", version: 1, stores: 1, managers: 0 },
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
  it("rename sends the id, the new name, the name and version seen, and only once the name differs", async () => {
    mocks.renameRegion.mockResolvedValue({ status: "saved", message: "Saved" });
    const user = userEvent.setup();
    render(<RenameRegionDialog {...shared} region={REGIONS[0]} />);
    expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Northeast");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(mocks.renameRegion).toHaveBeenCalledWith("r1", "Northeast", "North", 1);
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
