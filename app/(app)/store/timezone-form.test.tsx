import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));

vi.mock("./actions", () => ({ saveTimezoneAction: mocks.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { TimezoneForm } from "./timezone-form";

beforeEach(() => vi.clearAllMocks());

const zone = () => screen.getByLabelText("Time zone", { selector: "select" });

describe("TimezoneForm (auto-saves, R3)", () => {
  it("has no Save button", () => {
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("saves the moment a zone is chosen, with the version the page showed, says Saved, and reloads, with no toast", async () => {
    mocks.save.mockResolvedValue({ status: "saved", message: "Time zone saved" });
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await user.selectOptions(zone(), "America/Denver");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("America/Denver", 2));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("holds the picker still while a save is out without taking focus from it: the next change waits for the reload's version", async () => {
    let finish: (reply: { status: string; message: string }) => void = () => {};
    mocks.save.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    zone().focus();
    await user.selectOptions(zone(), "America/Denver");
    expect(zone()).not.toBeDisabled();
    expect(zone()).toHaveFocus();
    // A second pick during the save is not sent, and the picker still shows the zone being saved.
    await user.selectOptions(zone(), "America/Chicago");
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(zone()).toHaveValue("America/Denver");
    finish({ status: "saved", message: "Time zone saved" });
    await screen.findByText("Saved");
    await user.selectOptions(zone(), "America/Chicago");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  });

  it("after a refusal the picker shows the server's current zone once the reload lands", async () => {
    mocks.save.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    const { rerender } = render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await user.selectOptions(zone(), "America/Denver");
    await screen.findByText("Changed on another device");
    expect(zone()).toHaveValue("America/Los_Angeles");
    rerender(<TimezoneForm zone="America/Chicago" version={3} />);
    expect(zone()).toHaveValue("America/Chicago");
  });

  it("keeps focus on the picker through a refusal", async () => {
    mocks.save.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    zone().focus();
    await user.selectOptions(zone(), "America/Denver");
    await screen.findByText("Changed on another device");
    expect(zone()).toHaveFocus();
  });

  it("typing in the find box saves nothing", async () => {
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await user.type(screen.getByLabelText("Find a time zone"), "Denver");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("says a refusal under the field, puts the stored zone back, and does not toast", async () => {
    mocks.save.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await user.selectOptions(zone(), "America/Denver");
    expect(await screen.findByText("Changed on another device")).toBeInTheDocument();
    expect(screen.getByText("Couldn't save")).toBeInTheDocument();
    expect(zone()).toHaveValue("America/Los_Angeles");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("a lost connection is a toast, with the field left as chosen", async () => {
    mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await user.selectOptions(zone(), "America/Denver");
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't save" })));
    expect(zone()).toHaveValue("America/Denver");
  });
});
