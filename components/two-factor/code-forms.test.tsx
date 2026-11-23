import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import { NewBackupCodes } from "./new-codes";
import { VerifyForm } from "./verify-form";

beforeEach(() => vi.clearAllMocks());

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
