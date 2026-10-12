import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ email: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ signIn: { email: mocks.email } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import SignInPage from "./page";

async function submit() {
  const user = userEvent.setup();
  render(<SignInPage />);
  await user.type(screen.getByLabelText("Work email"), "van@example.com");
  await user.type(screen.getByLabelText("Password", { exact: true }), "correct-horse");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("SignInPage", () => {
  it("stays on Signing in… while the next page loads", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/products"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(sessionStorage.getItem("liminal:signed-in")).toBe("1");
    expect(screen.getByRole("button", { name: /Signing in…/ })).toBeDisabled();
  });

  it("a wrong password clears the button and says so", async () => {
    mocks.email.mockResolvedValue({ error: { status: 401 } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password do not match.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("a request that throws (offline) clears the button and names the connection", async () => {
    mocks.email.mockRejectedValue(new TypeError("Failed to fetch"));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server. Check the connection and try again.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
