import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), passkey: vi.fn(), getSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/lib/auth-client", () => ({ signIn: { passkey: mocks.passkey }, authClient: { getSession: mocks.getSession } }));

import { NewBackupCodes } from "./new-codes";
import { VerifyForm } from "./verify-form";

beforeEach(() => vi.clearAllMocks());

describe("VerifyForm with a passkey (A3c)", () => {
  it("Use a passkey signs in with it (a new session that passed a second factor) and lands on the next page", async () => {
    mocks.passkey.mockResolvedValue({ data: { session: {} }, error: null });
    render(<VerifyForm verify={vi.fn()} doneHref="/admin" passkey />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Use a passkey" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin"));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("with dropOld, asks for the session id before the prompt and deletes that old session after the new one is in place", async () => {
    const order: string[] = [];
    mocks.getSession.mockImplementation(async () => (order.push("session"), { data: { session: { id: "old-1" } } }));
    mocks.passkey.mockImplementation(async () => (order.push("passkey"), { data: { session: {} }, error: null }));
    const dropOld = vi.fn(async () => order.push("drop"));
    render(<VerifyForm verify={vi.fn()} dropOld={dropOld} doneHref="/admin" passkey />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Use a passkey" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin"));
    expect(dropOld).toHaveBeenCalledWith("old-1");
    expect(order).toEqual(["session", "passkey", "drop"]);
  });

  it("a refused passkey deletes nothing", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { id: "old-1" } } });
    mocks.passkey.mockResolvedValue({ data: null, error: { code: "PASSKEY_NOT_FOUND" } });
    const dropOld = vi.fn();
    render(<VerifyForm verify={vi.fn()} dropOld={dropOld} doneHref="/admin" passkey />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Use a passkey" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(dropOld).not.toHaveBeenCalled();
  });

  it("a passkey-only admin sees no code field; a refused passkey says so, a cancelled one says nothing", async () => {
    const user = userEvent.setup();
    render(<VerifyForm verify={vi.fn()} doneHref="/admin" totp={false} passkey />);
    expect(screen.queryByLabelText("Code from your authenticator app")).toBeNull();
    mocks.passkey.mockResolvedValueOnce({ data: null, error: { code: "ERROR_CEREMONY_ABORTED" } });
    await user.click(screen.getByRole("button", { name: "Use a passkey" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Use a passkey" })).toBeEnabled());
    expect(screen.queryByRole("alert")).toBeNull();
    mocks.passkey.mockResolvedValueOnce({ data: null, error: { code: "PASSKEY_NOT_FOUND", status: 401 } });
    await user.click(screen.getByRole("button", { name: "Use a passkey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That passkey didn't work.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("without a passkey the button is not there", () => {
    render(<VerifyForm verify={vi.fn()} doneHref="/admin" />);
    expect(screen.queryByRole("button", { name: "Use a passkey" })).toBeNull();
  });
});

describe("VerifyForm (admin step-up)", () => {
  it("sends the code, then lands on the next page and refreshes it", async () => {
    const verify = vi.fn().mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(<VerifyForm verify={verify} doneHref="/admin" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Confirm it's you");
    await user.type(screen.getByLabelText("Code from your authenticator app"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin"));
    expect(verify).toHaveBeenCalledWith("123456");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("a refused code says why and stays", async () => {
    const verify = vi.fn().mockResolvedValue({ status: "refused", message: "That code didn't work. Try the newest one." });
    const user = userEvent.setup();
    render(<VerifyForm verify={verify} doneHref="/admin" />);
    await user.type(screen.getByLabelText("Code from your authenticator app"), "000000");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work. Try the newest one.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("offline names the connection", async () => {
    const verify = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<VerifyForm verify={verify} doneHref="/admin" />);
    await user.type(screen.getByLabelText("Code from your authenticator app"), "000000");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server. Check the connection and try again.");
  });
});

describe("NewBackupCodes", () => {
  it("asks for the password, then shows the new codes with a Copy button and warns the old ones stopped", async () => {
    const make = vi.fn().mockResolvedValue({ status: "codes", backupCodes: ["aaaaa-bbbbb", "ccccc-ddddd"] });
    const user = userEvent.setup();
    render(<NewBackupCodes make={make} />);
    await user.type(screen.getByLabelText("Password", { exact: true }), "correct-horse");
    await user.click(screen.getByRole("button", { name: "New backup codes" }));
    expect(await screen.findByText("aaaaa-bbbbb")).toBeInTheDocument();
    expect(make).toHaveBeenCalledWith("correct-horse");
    expect(screen.getByText(/old ones no longer work/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy backup codes" })).toBeInTheDocument();
  });

  it("a refused password shows no codes", async () => {
    const make = vi.fn().mockResolvedValue({ status: "refused", message: "That isn't your password." });
    const user = userEvent.setup();
    render(<NewBackupCodes make={make} />);
    await user.type(screen.getByLabelText("Password", { exact: true }), "nope-nope");
    await user.click(screen.getByRole("button", { name: "New backup codes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That isn't your password.");
    expect(screen.queryByRole("list")).toBeNull();
  });
});
