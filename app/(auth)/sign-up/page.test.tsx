import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ email: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ signUp: { email: mocks.email } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import SignUpPage from "./page";

async function submit() {
  const user = userEvent.setup();
  render(<SignUpPage />);
  await user.type(screen.getByLabelText("Name"), "Van");
  await user.type(screen.getByLabelText("Work email"), "van@example.com");
  await user.type(screen.getByLabelText("Password", { exact: true }), "correct-horse");
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

beforeEach(() => vi.clearAllMocks());

describe("SignUpPage", () => {
  it("stays on Creating account… while the next page loads", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/products"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Creating account…/ })).toBeDisabled();
  });

  it("a rejected sign-up clears the button and shows the server's message", async () => {
    mocks.email.mockResolvedValue({ error: { message: "User already exists" } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("User already exists");
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("an empty error message falls back to a generic one and does not navigate", async () => {
    mocks.email.mockResolvedValue({ error: { message: "" } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not create the account.");
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("a request that throws (offline) clears the button and names the connection", async () => {
    mocks.email.mockRejectedValue(new TypeError("Failed to fetch"));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server. Check the connection and try again.");
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });
});
