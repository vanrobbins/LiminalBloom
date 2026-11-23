import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import { TwoFactorCard } from "./account-card";

const actions = () => ({ start: vi.fn(), confirm: vi.fn(), makeCodes: vi.fn(), disable: vi.fn() });
/** The turn-off form: the card also has the new-codes password field, so a field is looked for inside this one. */
const turnOff = () => within(screen.getByRole("button", { name: "Turn off two-step sign-in" }).closest("form")!);
const OFF = { on: false, codesLeft: 0, isAdmin: false };
const ON = { on: true, codesLeft: 7, isAdmin: false };

beforeEach(() => vi.clearAllMocks());

describe("TwoFactorCard", () => {
  it("off: says so, and Turn on opens the setup in place under its own heading", async () => {
    const user = userEvent.setup();
    render(<TwoFactorCard status={OFF} {...actions()} />);
    expect(screen.getByText(/^Off\./)).toBeInTheDocument();
    expect(screen.queryByLabelText("Password", { exact: true })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(screen.getByRole("heading", { level: 2, name: "Turn on two-step sign-in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password", { exact: true })).toBeInTheDocument();
  });

  it("on: says so with the backup codes left (one reads in the singular), and offers new codes and Turn off", () => {
    const { rerender } = render(<TwoFactorCard status={ON} {...actions()} />);
    expect(screen.getByText(/On\. Signing in asks for a code from your authenticator app\. 7 backup codes left\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New backup codes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn off" })).toBeInTheDocument();
    rerender(<TwoFactorCard status={{ ...ON, codesLeft: 1 }} {...actions()} />);
    expect(screen.getByText(/1 backup code left\./)).toBeInTheDocument();
  });

  it("an admin is told it stays on and is not offered Turn off", () => {
    render(<TwoFactorCard status={{ ...ON, isAdmin: true }} {...actions()} />);
    expect(screen.getByText("Liminal Bloom admins need two-step sign-in, so it stays on.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn off" })).toBeNull();
  });

  it("Turn off asks for the password and a code, sends both, and refreshes the page once it is off", async () => {
    const user = userEvent.setup();
    const a = actions();
    a.disable.mockResolvedValue({ status: "off" });
    render(<TwoFactorCard status={ON} {...a} />);
    await user.click(screen.getByRole("button", { name: "Turn off" }));
    await user.type(turnOff().getByLabelText("Password", { exact: true }), "correct-horse");
    await user.type(turnOff().getByLabelText("Code from your authenticator app"), "123456");
    await user.click(screen.getByRole("button", { name: "Turn off two-step sign-in" }));
    await waitFor(() => expect(a.disable).toHaveBeenCalledWith("correct-horse", "123456"));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("a refused Turn off says why under the fields and does not refresh; Cancel goes back", async () => {
    const user = userEvent.setup();
    const a = actions();
    a.disable.mockResolvedValue({ status: "refused", message: "That code didn't work. Try the newest one." });
    render(<TwoFactorCard status={ON} {...a} />);
    await user.click(screen.getByRole("button", { name: "Turn off" }));
    await user.type(turnOff().getByLabelText("Password", { exact: true }), "correct-horse");
    await user.type(turnOff().getByLabelText("Code from your authenticator app"), "000000");
    await user.click(screen.getByRole("button", { name: "Turn off two-step sign-in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work. Try the newest one.");
    expect(mocks.refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Turn off" })).toBeInTheDocument();
  });
});
