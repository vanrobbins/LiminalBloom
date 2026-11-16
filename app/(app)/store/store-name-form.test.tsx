import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rename: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));

vi.mock("./actions", () => ({ renameStoreAction: mocks.rename }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { StoreNameForm } from "./store-name-form";

beforeEach(() => vi.clearAllMocks());

const field = () => screen.getByLabelText("Store name");
const LENGTH = "Give the store a name of 2 to 60 characters.";

describe("StoreNameForm (auto-saves, R3)", () => {
  it("has no Save button", () => {
    render(<StoreNameForm name="Pioneer Place" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("saves on Enter with the name the page showed, says Saved beside the field, with no toast, and reloads", async () => {
    mocks.rename.mockResolvedValue({ status: "saved", message: "Store name saved" });
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    expect(field()).toHaveValue("Pioneer Place");
    await user.clear(field());
    await user.type(field(), "Riverside{Enter}");
    await waitFor(() => expect(mocks.rename).toHaveBeenCalledWith("Riverside", "Pioneer Place"));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("saves on blur", async () => {
    mocks.rename.mockResolvedValue({ status: "saved", message: "Store name saved" });
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    await user.type(field(), " East");
    await user.tab();
    await waitFor(() => expect(mocks.rename).toHaveBeenCalledWith("Pioneer Place East", "Pioneer Place"));
  });

  it("Enter and then blur save once, not twice", async () => {
    mocks.rename.mockResolvedValue({ status: "saved", message: "Store name saved" });
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    await user.type(field(), "x{Enter}");
    await user.tab();
    await screen.findByText("Saved");
    expect(mocks.rename).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when the name is as it was", async () => {
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    await user.click(field());
    await user.tab();
    await user.type(field(), "{Enter}");
    expect(mocks.rename).not.toHaveBeenCalled();
  });

  it.each([["x"], ["   "], [""]])("keeps %j in the field with the length line under it and sends nothing", async (typed) => {
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    await user.clear(field());
    if (typed) await user.type(field(), typed);
    await user.tab();
    expect(screen.getByText(LENGTH)).toBeInTheDocument();
    expect(field()).toHaveAccessibleDescription(LENGTH);
    expect(field()).toHaveValue(typed);
    expect(mocks.rename).not.toHaveBeenCalled();
    // Typing on clears the line.
    await user.type(field(), "ab");
    expect(screen.queryByText(LENGTH)).toBeNull();
  });

  it("shows a refusal under the field, shows the stored name again, and does not toast", async () => {
    mocks.rename.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    await user.type(field(), "x");
    await user.tab();
    expect(await screen.findByText("Changed on another device")).toBeInTheDocument();
    expect(screen.getByText("Couldn't save")).toBeInTheDocument();
    expect(field()).toHaveValue("Pioneer Place");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("after a refusal the field shows the server's current name once the reload lands, and a save's reload keeps focus in the field", async () => {
    mocks.rename.mockResolvedValueOnce({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    const { rerender } = render(<StoreNameForm name="Pioneer Place" />);
    await user.type(field(), "x");
    await user.tab();
    await screen.findByText("Changed on another device");
    expect(field()).toHaveValue("Pioneer Place");
    rerender(<StoreNameForm name="Riverside" />);
    expect(field()).toHaveValue("Riverside");
    // A save that lands: the page reloads with the typed name, and the field is still the one being used.
    mocks.rename.mockResolvedValue({ status: "saved", message: "Store name saved" });
    await user.clear(field());
    await user.type(field(), "Harbor{Enter}");
    await screen.findByText("Saved");
    rerender(<StoreNameForm name="Harbor" />);
    expect(field()).toHaveValue("Harbor");
    expect(field()).toHaveFocus();
  });

  it("the stored name is what a repeat of the old one is compared with after the reload", async () => {
    mocks.rename.mockResolvedValue({ status: "saved", message: "Store name saved" });
    const user = userEvent.setup();
    const { rerender } = render(<StoreNameForm name="Pioneer Place" />);
    await user.type(field(), "x{Enter}");
    await screen.findByText("Saved");
    rerender(<StoreNameForm name="Pioneer Placex" />);
    await user.clear(field());
    await user.type(field(), "Pioneer Place{Enter}");
    await waitFor(() => expect(mocks.rename).toHaveBeenLastCalledWith("Pioneer Place", "Pioneer Placex"));
  });

  it("a lost connection is a toast, and the next blur tries again", async () => {
    mocks.rename.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mocks.rename.mockResolvedValue({ status: "saved", message: "Store name saved" });
    const user = userEvent.setup();
    render(<StoreNameForm name="Pioneer Place" />);
    await user.type(field(), "x");
    await user.tab();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't save" })));
    await user.click(field());
    await user.tab();
    await waitFor(() => expect(mocks.rename).toHaveBeenCalledTimes(2));
    await screen.findByText("Saved");
  });
});
