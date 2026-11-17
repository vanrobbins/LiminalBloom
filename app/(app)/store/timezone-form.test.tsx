import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));

vi.mock("./actions", () => ({ saveTimezoneAction: mocks.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { TimezoneForm } from "./timezone-form";

beforeEach(() => vi.clearAllMocks());

const zone = () => screen.getByRole("button", { name: /^Time zone/ });
const NAMES: Record<string, string> = {
  "America/Denver": "Mountain (America/Denver)",
  "America/Chicago": "Central (America/Chicago)",
  "America/New_York": "Eastern (America/New York)",
};
/** Opens the picker and clicks a zone, as a person would. */
async function pick(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.click(zone());
  await user.click(screen.getByRole("option", { name: NAMES[id] }));
}

describe("TimezoneForm (auto-saves, R3)", () => {
  it("has no Save button", () => {
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  it("saves the moment a zone is chosen, with the version the page showed, says Saved, and reloads, with no toast", async () => {
    mocks.save.mockResolvedValue({ status: "saved", message: "Time zone saved" });
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await pick(user, "America/Denver");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("America/Denver", 2));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("a pick made while a save is out is kept and sent once the reload brings the new version: the latest pick wins, and the picker keeps its focus", async () => {
    let finish: (reply: { status: string; message: string }) => void = () => {};
    mocks.save.mockReturnValueOnce(new Promise((resolve) => (finish = resolve))).mockResolvedValue({ status: "saved", message: "Time zone saved" });
    const user = userEvent.setup();
    // The reload lands as new props, in the same transition that ends the busy state, as the real refresh does.
    let land: (zone: string, version: number) => void = () => {};
    function Page() {
      const [page, setPage] = useState({ zone: "America/Los_Angeles", version: 2 });
      land = (z, v) => setPage({ zone: z, version: v });
      return <TimezoneForm zone={page.zone} version={page.version} />;
    }
    mocks.refresh.mockImplementation(() => land("America/Denver", 3));
    render(<Page />);
    zone().focus();
    await pick(user, "America/Denver");
    expect(zone()).not.toBeDisabled();
    expect(zone()).toHaveFocus();
    await pick(user, "America/Chicago");
    await pick(user, "America/New_York");
    // Nothing is sent while the first is out, and the picker shows the latest pick.
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(zone()).toHaveTextContent("Eastern (America/New York)");
    finish({ status: "saved", message: "Time zone saved" });
    // The reload lands with the first zone and the next version; only then does the last pick go.
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save).toHaveBeenLastCalledWith("America/New_York", 3);
    expect(zone()).toHaveTextContent("Eastern (America/New York)");
    expect(zone()).toHaveFocus();
  });

  it("after a refusal the picker shows the server's current zone once the reload lands", async () => {
    mocks.save.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    const { rerender } = render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await pick(user, "America/Denver");
    await screen.findByText("Changed on another device");
    expect(zone()).toHaveTextContent("Pacific (America/Los Angeles)");
    rerender(<TimezoneForm zone="America/Chicago" version={3} />);
    expect(zone()).toHaveTextContent("Central (America/Chicago)");
  });

  it("keeps focus on the picker through a refusal", async () => {
    mocks.save.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    zone().focus();
    await pick(user, "America/Denver");
    await screen.findByText("Changed on another device");
    expect(zone()).toHaveFocus();
  });

  it("searching and arrowing through the list save nothing; only a pick does", async () => {
    mocks.save.mockResolvedValue({ status: "saved", message: "Time zone saved" });
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await user.click(zone());
    await user.type(screen.getByRole("combobox", { name: "Find a time zone" }), "Denver");
    await user.keyboard("{ArrowDown}{ArrowUp}");
    expect(mocks.save).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save).toHaveBeenCalledWith("America/Denver", 2);
  });

  it("says a refusal under the field, puts the stored zone back, and does not toast", async () => {
    mocks.save.mockResolvedValue({ status: "refused", message: "Changed on another device" });
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await pick(user, "America/Denver");
    expect(await screen.findByText("Changed on another device")).toBeInTheDocument();
    expect(screen.getByText("Couldn't save")).toBeInTheDocument();
    expect(zone()).toHaveTextContent("Pacific (America/Los Angeles)");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("a lost connection is a toast, with the field left as chosen", async () => {
    mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<TimezoneForm zone="America/Los_Angeles" version={2} />);
    await pick(user, "America/Denver");
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't save" })));
    expect(zone()).toHaveTextContent("Mountain (America/Denver)");
  });
});
