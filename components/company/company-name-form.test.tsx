// The auto-saved company name on /company: what it sends, when it sends nothing, and what it does when the server refuses.

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

beforeEach(() => {
  vi.clearAllMocks();
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
