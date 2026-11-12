import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rename: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));

vi.mock("./actions", () => ({ renameStoreAction: mocks.rename }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { StoreNameForm } from "./store-name-form";

beforeEach(() => vi.clearAllMocks());

describe("StoreNameForm", () => {
  it("sends the typed name with the name the page showed, then says so and reloads", async () => {
    mocks.rename.mockResolvedValue({ status: "saved", message: "Store name saved" });
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    const field = screen.getByLabelText("Store name");
    expect(field).toHaveValue("Pioneer Place");
    await user.clear(field);
    await user.type(field, "Riverside");
    await user.click(screen.getByRole("button", { name: "Save store name" }));
    await waitFor(() => expect(mocks.rename).toHaveBeenCalledWith("Riverside", "Pioneer Place"));
    expect(mocks.toast).toHaveBeenCalledWith({ tone: "success", title: "Store name saved" });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows a refusal as an error", async () => {
    mocks.rename.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    await user.type(screen.getByLabelText("Store name"), "x");
    await user.click(screen.getByRole("button", { name: "Save store name" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ tone: "error", title: "Changed on another device" }));
  });

  it("says it couldn't save when the request throws", async () => {
    mocks.rename.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    await user.type(screen.getByLabelText("Store name"), "x");
    await user.click(screen.getByRole("button", { name: "Save store name" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't save" })));
    expect(screen.getByRole("button", { name: "Save store name" })).toBeEnabled();
  });
});
