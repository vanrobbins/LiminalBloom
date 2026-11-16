import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ change: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));

vi.mock("./actions", () => ({ changePasswordAction: mocks.change }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { ChangePasswordForm } from "./change-password-form";

beforeEach(() => vi.clearAllMocks());

async function fill(current = "old-password-1", next = "new-password-2", confirm = "new-password-2") {
  const user = userEvent.setup();
  render(<ChangePasswordForm />);
  await user.click(screen.getByRole("button", { name: "Change password" }));
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(screen.getByLabelText("New password"), next);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Save new password" }));
}

describe("ChangePasswordForm", () => {
  it("keeps the form folded, out of reach, behind a worded button until it is pressed", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);
    const button = screen.getByRole("button", { name: "Change password" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    const body = document.getElementById(button.getAttribute("aria-controls") ?? "");
    expect(body).toContainElement(screen.getByLabelText("Current password"));
    expect(body).toHaveAttribute("inert");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(body).not.toHaveAttribute("inert");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(body).toHaveAttribute("inert");
  });

  it("asks for the current password, the new one and a confirmation, and says other sessions end", () => {
    render(<ChangePasswordForm />);
    for (const label of ["Current password", "New password", "Confirm new password"]) expect(screen.getByLabelText(label)).toBeRequired();
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText(/signs you out everywhere else/)).toBeInTheDocument();
  });

  it("sends the three values, then clears the fields, says so and reloads", async () => {
    mocks.change.mockResolvedValue({ status: "saved", message: "Password changed. Your other sessions were signed out." });
    await fill();
    await waitFor(() => expect(mocks.change).toHaveBeenCalledWith("old-password-1", "new-password-2", "new-password-2"));
    expect(mocks.toast).toHaveBeenCalledWith({ tone: "success", title: "Password changed. Your other sessions were signed out." });
    expect(mocks.refresh).toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "Change password" });
    await waitFor(() => expect(button).toHaveAttribute("aria-expanded", "false"));
    expect(button).toHaveFocus();
    expect(document.querySelector<HTMLInputElement>("input[name=current]")).toHaveValue("");
    expect(document.querySelector<HTMLInputElement>("input[name=new]")).toHaveValue("");
  });

  it("shows a wrong current password next to that field and keeps what was typed", async () => {
    mocks.change.mockResolvedValue({ status: "refused", field: "current", message: "That isn't your current password." });
    await fill();
    const field = screen.getByLabelText("Current password");
    await waitFor(() => expect(field).toBeInvalid());
    expect(field).toHaveAccessibleDescription("That isn't your current password.");
    expect(screen.getByLabelText("New password")).toHaveValue("new-password-2");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("forgets the typed passwords and the error when the form folds shut", async () => {
    mocks.change.mockResolvedValue({ status: "refused", field: "current", message: "That isn't your current password." });
    await fill();
    await screen.findByText("That isn't your current password.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.queryByText("That isn't your current password.")).toBeNull();
    for (const name of ["current", "new", "confirm"]) expect(document.querySelector<HTMLInputElement>(`input[name=${name}]`)).toHaveValue("");
    expect(screen.getByLabelText("Current password")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("shows a mismatch next to the confirmation field", async () => {
    mocks.change.mockResolvedValue({ status: "refused", field: "confirm", message: "The two new passwords don't match." });
    await fill("old-password-1", "new-password-2", "new-password-3");
    expect(await screen.findByText("The two new passwords don't match.")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInvalid();
  });

  it("says a general failure as an alert", async () => {
    mocks.change.mockResolvedValueOnce({ status: "refused", message: "Couldn't change the password. Try again." });
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't change the password. Try again.");
    expect(screen.getByRole("button", { name: "Save new password" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Change password" })).toHaveAttribute("aria-expanded", "true");
  });

  it("names the connection when the request throws", async () => {
    mocks.change.mockRejectedValue(new TypeError("Failed to fetch"));
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });
});

describe("ChangePasswordForm folded mid-save", () => {
  it("drops an error that arrives after the form was folded", async () => {
    let answer: (value: unknown) => void = () => {};
    mocks.change.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const user = userEvent.setup();
    await fill();
    await user.click(screen.getByRole("button", { name: "Change password" }));
    answer({ status: "error", field: "current", message: "That isn't your current password." });
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save new password" })).toBeEnabled());
    expect(screen.queryByText("That isn't your current password.")).toBeNull();
  });
});
