import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), addPasskey: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { passkey: { addPasskey: mocks.addPasskey } } }));

import { PasskeyCard } from "./passkey-card";

const actions = () => ({ allow: vi.fn(), rename: vi.fn(), remove: vi.fn() });
const PHONE = { id: "k1", name: "Phone", createdAt: new Date("2026-11-20T10:00:00Z"), lastUsedAt: new Date("2026-11-22T10:00:00Z") };
const UNNAMED = { id: "k2", name: null, createdAt: new Date("2026-11-21T10:00:00Z"), lastUsedAt: null };

beforeEach(() => vi.clearAllMocks());

describe("PasskeyCard", () => {
  it("none yet: says so and offers Add a passkey", () => {
    render(<PasskeyCard passkeys={[]} {...actions()} />);
    expect(screen.getByText(/None yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a passkey" })).toBeInTheDocument();
  });

  it("lists each with when it was added and last used, an unnamed one as Passkey, one never used as Not used yet", () => {
    render(<PasskeyCard passkeys={[PHONE, UNNAMED]} {...actions()} />);
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("Added Nov 20 · Last used Nov 22")).toBeInTheDocument();
    expect(screen.getByText("Passkey")).toBeInTheDocument();
    expect(screen.getByText("Added Nov 21 · Not used yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add another passkey" })).toBeInTheDocument();
  });

  it("rename: saves the new name and reads the page again", async () => {
    const user = userEvent.setup();
    const a = actions();
    a.rename.mockResolvedValue({ status: "ok" });
    render(<PasskeyCard passkeys={[PHONE]} {...a} />);
    await user.click(screen.getByRole("button", { name: "Rename Phone" }));
    const field = screen.getByLabelText("Name");
    await user.clear(field);
    await user.type(field, "Work phone");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(a.rename).toHaveBeenCalledWith("k1", "Work phone");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("remove: asks for the password, and a refusal stays in the row", async () => {
    const user = userEvent.setup();
    const a = actions();
    a.remove.mockResolvedValue({ status: "refused", message: "This is your only passkey, and you need it to sign in with two steps." });
    render(<PasskeyCard passkeys={[PHONE]} {...a} />);
    await user.click(screen.getByRole("button", { name: "Remove Phone" }));
    await user.type(screen.getByLabelText(/Password, to remove Phone/), "pw-12345");
    await user.click(screen.getByRole("button", { name: "Remove passkey" }));
    expect(a.remove).toHaveBeenCalledWith("k1", "pw-12345");
    expect(await screen.findByRole("alert")).toHaveTextContent("only passkey");
    expect(mocks.refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Phone")).toBeInTheDocument();
  });

  it("add: the password first, then the browser's prompt, then the name; the page is read again", async () => {
    const user = userEvent.setup();
    const a = actions();
    a.allow.mockResolvedValue({ status: "ok" });
    a.rename.mockResolvedValue({ status: "ok" });
    mocks.addPasskey.mockResolvedValue({ data: { id: "new-1" }, error: null });
    render(<PasskeyCard passkeys={[]} {...a} />);
    await user.click(screen.getByRole("button", { name: "Add a passkey" }));
    await user.type(screen.getByLabelText("Name"), "Work laptop");
    await user.type(screen.getByLabelText("Password"), "pw-12345");
    await user.click(screen.getByRole("button", { name: "Add passkey" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(a.allow).toHaveBeenCalledWith("pw-12345", undefined);
    expect(a.rename).toHaveBeenCalledWith("new-1", "Work laptop");
    expect(a.allow.mock.invocationCallOrder[0]).toBeLessThan(mocks.addPasskey.mock.invocationCallOrder[0]);
  });

  it("add: with an authenticator app on, the form asks for the code too and sends it", async () => {
    const user = userEvent.setup();
    const a = actions();
    a.allow.mockResolvedValue({ status: "ok" });
    mocks.addPasskey.mockResolvedValue({ data: { id: "new-2" }, error: null });
    render(<PasskeyCard passkeys={[]} needsCode {...a} />);
    await user.click(screen.getByRole("button", { name: "Add a passkey" }));
    await user.type(screen.getByLabelText("Password"), "pw-12345");
    await user.type(screen.getByLabelText("Code"), "123456");
    await user.click(screen.getByRole("button", { name: "Add passkey" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(a.allow).toHaveBeenCalledWith("pw-12345", "123456");
  });

  it("add: with no app there is no code field", async () => {
    const user = userEvent.setup();
    render(<PasskeyCard passkeys={[]} {...actions()} />);
    await user.click(screen.getByRole("button", { name: "Add a passkey" }));
    expect(screen.queryByLabelText("Code")).toBeNull();
  });

  it("add: a wrong password never opens the browser's prompt; a cancelled prompt says nothing", async () => {
    const user = userEvent.setup();
    const a = actions();
    a.allow.mockResolvedValueOnce({ status: "refused", message: "That isn't your password." });
    render(<PasskeyCard passkeys={[]} {...a} />);
    await user.click(screen.getByRole("button", { name: "Add a passkey" }));
    await user.type(screen.getByLabelText("Password"), "nope");
    await user.click(screen.getByRole("button", { name: "Add passkey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That isn't your password.");
    expect(mocks.addPasskey).not.toHaveBeenCalled();
    a.allow.mockResolvedValueOnce({ status: "ok" });
    mocks.addPasskey.mockResolvedValueOnce({ data: null, error: { code: "ERROR_CEREMONY_ABORTED" } });
    await user.click(screen.getByRole("button", { name: "Add passkey" }));
    await waitFor(() => expect(mocks.addPasskey).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
