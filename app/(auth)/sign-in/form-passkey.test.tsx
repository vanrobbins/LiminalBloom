// "Sign in with a passkey" and browser autofill on the sign-in form (spec 0.7.1 8.4, A3c).

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ email: vi.fn(), passkey: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ signIn: { email: mocks.email, passkey: mocks.passkey } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import { SignInForm } from "./form";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("SignInForm with a passkey", () => {
  it("the email field offers browser autofill for passkeys", () => {
    render(<SignInForm next={null} />);
    expect(screen.getByLabelText("Work email")).toHaveAttribute("autocomplete", "username webauthn");
  });

  it("the button signs in with a passkey and goes Home, with no code step", async () => {
    mocks.passkey.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
    render(<SignInForm next={null} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in with a passkey" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.passkey).toHaveBeenCalledWith();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("keeps the return path, and ignores one that leaves the site", async () => {
    mocks.passkey.mockResolvedValue({ data: { session: {} }, error: null });
    const { unmount } = render(<SignInForm next="/invite/abc123" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in with a passkey" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/invite/abc123"));
    unmount();
    mocks.push.mockClear();
    render(<SignInForm next="//evil.example/x" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in with a passkey" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
  });

  it("a cancelled prompt says nothing; a refused passkey says so and offers the password", async () => {
    const user = userEvent.setup();
    render(<SignInForm next={null} />);
    mocks.passkey.mockResolvedValueOnce({ data: null, error: { code: "ERROR_CEREMONY_ABORTED", status: 400 } });
    await user.click(screen.getByRole("button", { name: "Sign in with a passkey" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in with a passkey" })).toBeEnabled());
    expect(screen.queryByRole("alert")).toBeNull();
    mocks.passkey.mockResolvedValueOnce({ data: null, error: { code: "PASSKEY_NOT_FOUND", status: 401 } });
    await user.click(screen.getByRole("button", { name: "Sign in with a passkey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That passkey didn't work. Try again, or sign in with your password.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("a request that throws (offline) names the connection", async () => {
    mocks.passkey.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<SignInForm next={null} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in with a passkey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server.");
  });

  it("starts browser autofill when the browser supports it, and signs in if the person picks a passkey", async () => {
    vi.stubGlobal("PublicKeyCredential", { isConditionalMediationAvailable: async () => true });
    mocks.passkey.mockResolvedValue({ data: { session: {} }, error: null });
    render(<SignInForm next={null} />);
    await waitFor(() => expect(mocks.passkey).toHaveBeenCalledWith({ autoFill: true }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
  });

  it("does not ask the browser for autofill when it has none, and a failed autofill leaves the form usable", async () => {
    render(<SignInForm next={null} />);
    expect(mocks.passkey).not.toHaveBeenCalled();
    vi.stubGlobal("PublicKeyCredential", { isConditionalMediationAvailable: async () => true });
    mocks.passkey.mockRejectedValue(new Error("aborted"));
    render(<SignInForm next={null} />);
    await waitFor(() => expect(mocks.passkey).toHaveBeenCalledWith({ autoFill: true }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
