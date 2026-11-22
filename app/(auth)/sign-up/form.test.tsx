import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ email: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ signUp: { email: mocks.email } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import { SignUpForm } from "./form";

async function submit(next: string | null = null) {
  const user = userEvent.setup();
  render(<SignUpForm next={next} />);
  await user.type(screen.getByLabelText("Name"), "Van");
  await user.type(screen.getByLabelText("Work email"), "van@example.com");
  await user.type(screen.getByLabelText("Password", { exact: true }), "correct-horse");
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

beforeEach(() => vi.clearAllMocks());

describe("SignUpForm", () => {
  it("stays on Creating account… while the next page loads", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Creating account…/ })).toBeDisabled();
  });

  it("signs up for the browser session only (rememberMe false), like sign-in's default", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit();
    expect(mocks.email).toHaveBeenCalledWith({ name: "Van", email: "van@example.com", password: "correct-horse", rememberMe: false });
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

  it("returns to the page it was sent from (an invitation) after creating the account", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit("/invite/abc123");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/invite/abc123"));
  });

  it("ignores a return path that leaves the site", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit("https://evil.example");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
  });

  it("keeps the return path on the link to sign in", () => {
    render(<SignUpForm next="/invite/abc123" />);
    expect(screen.getByRole("link", { name: "Already have an account? Sign in" })).toHaveAttribute("href", "/sign-in?next=%2Finvite%2Fabc123");
  });
});
