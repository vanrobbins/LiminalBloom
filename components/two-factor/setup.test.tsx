import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import { TwoFactorSetup } from "./setup";

const URI = "otpauth://totp/Liminal%20Bloom:van%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Liminal%20Bloom";
const CODES = ["aaaaa-bbbbb", "ccccc-ddddd"];
const started = { status: "started", otpauthUri: URI, setupKey: "JBSWY3DPEHPK3PXP", backupCodes: CODES } as const;

const props = () => ({ intro: "Liminal Bloom admins need it.", start: vi.fn(), confirm: vi.fn(), doneHref: "/admin" });

beforeEach(() => vi.clearAllMocks());

async function startUp(p: ReturnType<typeof props>) {
  p.start.mockResolvedValue(started);
  const user = userEvent.setup();
  render(<TwoFactorSetup {...p} />);
  await user.type(screen.getByLabelText("Password", { exact: true }), "correct-horse");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  return user;
}

describe("TwoFactorSetup", () => {
  it("opens on the password step only: no key, no codes, no code field yet", () => {
    render(<TwoFactorSetup {...props()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Turn on two-step sign-in");
    expect(screen.getByText("Liminal Bloom admins need it.")).toBeInTheDocument();
    expect(screen.queryByText(/JBSW/)).toBeNull();
    expect(screen.queryByLabelText("Code from your authenticator app")).toBeNull();
  });

  it("a refused password says why and shows nothing else", async () => {
    const p = props();
    p.start.mockResolvedValue({ status: "refused", message: "That isn't your password." });
    const user = userEvent.setup();
    render(<TwoFactorSetup {...p} />);
    await user.type(screen.getByLabelText("Password", { exact: true }), "nope-nope");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That isn't your password.");
    expect(screen.queryByText(/JBSW/)).toBeNull();
  });

  it("shows the setup key in groups of four, an authenticator link, and the ten codes", async () => {
    await startUp(props());
    expect(await screen.findByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in authenticator app" })).toHaveAttribute("href", URI);
    expect(screen.getByRole("button", { name: "Copy setup key" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy backup codes" })).toBeInTheDocument();
    for (const code of CODES) expect(screen.getByText(code)).toBeInTheDocument();
  });

  it("copies the key without its spaces, and the codes one per line", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const user = await startUp(props());
    Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
    await user.click(await screen.findByRole("button", { name: "Copy setup key" }));
    expect(write).toHaveBeenLastCalledWith("JBSWY3DPEHPK3PXP");
    await user.click(screen.getByRole("button", { name: "Copy backup codes" }));
    expect(write).toHaveBeenLastCalledWith(CODES.join("\n"));
  });

  it("will not finish until the backup codes are ticked as saved", async () => {
    const p = props();
    const user = await startUp(p);
    await user.type(await screen.findByLabelText("Code from your authenticator app"), "123456");
    const finish = screen.getByRole("button", { name: "Turn on two-step sign-in" });
    expect(finish).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "I saved these codes somewhere safe." }));
    expect(finish).toBeEnabled();
  });

  it("a right code lands on the next page and refreshes it; the action got the code", async () => {
    const p = props();
    p.confirm.mockResolvedValue({ status: "on" });
    const user = await startUp(p);
    await user.type(await screen.findByLabelText("Code from your authenticator app"), "123456");
    await user.click(screen.getByRole("checkbox", { name: "I saved these codes somewhere safe." }));
    await user.click(screen.getByRole("button", { name: "Turn on two-step sign-in" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin"));
    expect(p.confirm).toHaveBeenCalledWith("123456");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("a second submit while the first is still answering does nothing (one confirm, not two)", async () => {
    const p = props();
    let answer: (reply: { status: "on" }) => void = () => {};
    p.confirm.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const user = await startUp(p);
    await user.type(await screen.findByLabelText("Code from your authenticator app"), "123456");
    await user.click(screen.getByRole("checkbox", { name: "I saved these codes somewhere safe." }));
    const form = screen.getByRole("button", { name: "Turn on two-step sign-in" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(p.confirm).toHaveBeenCalledTimes(1);
    answer({ status: "on" });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
  });

  it("a wrong code says so and stays on the page", async () => {
    const p = props();
    p.confirm.mockResolvedValue({ status: "refused", message: "That code didn't work. Try the newest one." });
    const user = await startUp(p);
    await user.type(await screen.findByLabelText("Code from your authenticator app"), "000000");
    await user.click(screen.getByRole("checkbox", { name: "I saved these codes somewhere safe." }));
    await user.click(screen.getByRole("button", { name: "Turn on two-step sign-in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work. Try the newest one.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("offline names the connection", async () => {
    const p = props();
    p.start.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<TwoFactorSetup {...p} />);
    await user.type(screen.getByLabelText("Password", { exact: true }), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server. Check the connection and try again.");
  });
});
