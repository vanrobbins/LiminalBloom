import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ email: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ signIn: { email: mocks.email } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import { SignInForm } from "./form";

async function submit(next: string | null = null) {
  const user = userEvent.setup();
  render(<SignInForm next={next} />);
  await user.type(screen.getByLabelText("Work email"), "van@example.com");
  await user.type(screen.getByLabelText("Password", { exact: true }), "correct-horse");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("SignInForm", () => {
  it("stays on Signing in… while the next page loads", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
    expect(mocks.refresh).toHaveBeenCalled();
    // No "Opened <store>" notice any more, so no flag is left for it.
    expect(sessionStorage.getItem("liminal:signed-in")).toBeNull();
    expect(screen.getByRole("button", { name: /Signing in…/ })).toBeDisabled();
  });

  it("a wrong password clears the button and says so", async () => {
    mocks.email.mockResolvedValue({ error: { status: 401 } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password do not match.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("a sign-in limit (429) says to wait, not that the password is wrong", async () => {
    mocks.email.mockResolvedValue({ error: { status: 429 } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many sign-in attempts. Wait a moment, then try again.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("a request that throws (offline) clears the button and names the connection", async () => {
    mocks.email.mockRejectedValue(new TypeError("Failed to fetch"));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server. Check the connection and try again.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("returns to the page it was sent from (an invitation) after signing in", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit("/invite/abc123");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/invite/abc123"));
  });

  it("ignores a return path that leaves the site", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit("//evil.example/x");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
  });

  it("an account with two-factor on is sent to the code page, not Home, and no session refresh is needed", async () => {
    mocks.email.mockResolvedValue({ data: { twoFactorRedirect: true, twoFactorMethods: ["totp"] }, error: null });
    await submit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/sign-in/two-factor"));
    expect(mocks.push).not.toHaveBeenCalledWith("/home");
  });

  it("keeps the return path on the way to the code page", async () => {
    mocks.email.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    await submit("/invite/abc123");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/sign-in/two-factor?next=%2Finvite%2Fabc123"));
  });

  it("a reply with data but no redirect is an ordinary sign-in", async () => {
    mocks.email.mockResolvedValue({ data: { redirect: false, token: "t" }, error: null });
    await submit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
  });

  it("offers Keep me signed in, off until ticked", () => {
    render(<SignInForm next={null} />);
    expect(screen.getByRole("checkbox", { name: "Keep me signed in" })).not.toBeChecked();
  });

  it("signs in for the browser session only (rememberMe false) unless Keep me signed in is ticked", async () => {
    mocks.email.mockResolvedValue({ error: null });
    await submit();
    expect(mocks.email).toHaveBeenCalledWith({ email: "van@example.com", password: "correct-horse", rememberMe: false });
  });

  it("asks for a lasting session (rememberMe true) when Keep me signed in is ticked", async () => {
    mocks.email.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignInForm next={null} />);
    await user.type(screen.getByLabelText("Work email"), "van@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "correct-horse");
    await user.click(screen.getByRole("checkbox", { name: "Keep me signed in" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.email).toHaveBeenCalledWith({ email: "van@example.com", password: "correct-horse", rememberMe: true });
  });

  it("keeps the return path on the link to create an account", () => {
    render(<SignInForm next="/invite/abc123" />);
    expect(screen.getByRole("link", { name: "Need an account? Create one" })).toHaveAttribute("href", "/sign-up?next=%2Finvite%2Fabc123");
  });

  it("links to a bare sign-up page when there is nowhere to return to", () => {
    render(<SignInForm next={null} />);
    expect(screen.getByRole("link", { name: "Need an account? Create one" })).toHaveAttribute("href", "/sign-up");
  });
});
