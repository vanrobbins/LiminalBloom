import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verifyTotp: vi.fn(), verifyBackupCode: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ authClient: { twoFactor: { verifyTotp: mocks.verifyTotp, verifyBackupCode: mocks.verifyBackupCode } } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import { TwoFactorForm } from "./form";

beforeEach(() => vi.clearAllMocks());

async function enter(code: string, next: string | null = null, backup = false) {
  const user = userEvent.setup();
  render(<TwoFactorForm next={next} />);
  if (backup) await user.click(screen.getByRole("button", { name: "Use a backup code instead" }));
  await user.type(screen.getByLabelText(backup ? "Backup code" : "Code from your authenticator app"), code);
  await user.click(screen.getByRole("button", { name: "Verify" }));
}

describe("TwoFactorForm", () => {
  it("asks for the authenticator code, as a one-time numeric code", () => {
    render(<TwoFactorForm next={null} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Two-step sign-in");
    const field = screen.getByLabelText("Code from your authenticator app");
    expect(field).toHaveAttribute("autocomplete", "one-time-code");
    expect(field).toHaveAttribute("inputmode", "numeric");
  });

  it("a right code goes to Home and refreshes the page so it reads the new session", async () => {
    mocks.verifyTotp.mockResolvedValue({ data: { token: "t" }, error: null });
    await enter("123456");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
    expect(mocks.verifyTotp).toHaveBeenCalledWith({ code: "123456", trustDevice: false });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("returns to the page the person was sent from, only if it stays on this site", async () => {
    mocks.verifyTotp.mockResolvedValue({ data: {}, error: null });
    await enter("123456", "/invite/abc123");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/invite/abc123"));
  });

  it("trusts this device only when the box is ticked, and says for how long", async () => {
    mocks.verifyTotp.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<TwoFactorForm next={null} />);
    expect(screen.getByLabelText("Trust this device for 30 days")).not.toBeChecked();
    await user.click(screen.getByLabelText("Trust this device for 30 days"));
    await user.type(screen.getByLabelText("Code from your authenticator app"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(mocks.verifyTotp).toHaveBeenCalledWith({ code: "123456", trustDevice: true }));
  });

  it("a wrong code says so, keeps the form and stays here", async () => {
    mocks.verifyTotp.mockResolvedValue({ data: null, error: { status: 401, code: "INVALID_CODE" } });
    await enter("000000");
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work. Try the newest one.");
    expect(screen.getByRole("button", { name: "Verify" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("the rate limit (429) says to wait a few seconds", async () => {
    mocks.verifyTotp.mockResolvedValue({ data: null, error: { status: 429 } });
    await enter("000000");
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries. Wait a few seconds, then try again.");
    expect(screen.queryByRole("link", { name: "Sign in again" })).toBeNull();
  });

  it("a locked account says 15 minutes and links back to sign-in, keeping the return path", async () => {
    mocks.verifyTotp.mockResolvedValue({ data: null, error: { status: 429, code: "ACCOUNT_TEMPORARILY_LOCKED" } });
    await enter("000000", "/invite/abc123");
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries. Sign in again in 15 minutes.");
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/sign-in?next=%2Finvite%2Fabc123");
  });

  it("a timed-out sign-in says so and links back to sign-in", async () => {
    mocks.verifyTotp.mockResolvedValue({ data: null, error: { status: 401, code: "INVALID_TWO_FACTOR_COOKIE" } });
    await enter("123456");
    expect(await screen.findByRole("alert")).toHaveTextContent("This sign-in timed out. Sign in again.");
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/sign-in");
  });

  it("offline names the connection", async () => {
    mocks.verifyTotp.mockRejectedValue(new TypeError("Failed to fetch"));
    await enter("123456");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server. Check the connection and try again.");
  });

  it("\"Use a backup code instead\" swaps the field, sends the code to the backup route, and can swap back", async () => {
    mocks.verifyBackupCode.mockResolvedValue({ data: {}, error: null });
    await enter("MrqWQ-waTkk", null, true);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
    expect(mocks.verifyBackupCode).toHaveBeenCalledWith({ code: "MrqWQ-waTkk", trustDevice: false });
    expect(mocks.verifyTotp).not.toHaveBeenCalled();
  });

  it("swapping back restores the app code field and clears what was typed", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm next={null} />);
    await user.click(screen.getByRole("button", { name: "Use a backup code instead" }));
    await user.type(screen.getByLabelText("Backup code"), "abc");
    await user.click(screen.getByRole("button", { name: "Use the app code instead" }));
    expect(screen.getByLabelText("Code from your authenticator app")).toHaveValue("");
  });
});
