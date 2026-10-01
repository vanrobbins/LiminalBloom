import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  setTheme: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: mocks.signOut } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: mocks.setTheme }),
}));

import { UserMenu } from "./user-menu";

const USER = { name: "Van", email: "van@example.com" };

async function openDropdown(user: ReturnType<typeof userEvent.setup>, name: string) {
  screen.getByRole("button", { name }).focus();
  await user.keyboard("{Enter}");
  return screen.findByRole("menu");
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Account menu" }));
  return screen.findByRole("dialog", { name: "Van" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
});

describe("UserMenu", () => {
  it("shows who is signed in, links to Account, and offers the other theme", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} variant="sidebar" />);

    await openDropdown(user, "Van");

    expect(screen.getByText("van@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Account" })).toHaveAttribute("href", "/account");
    await user.click(screen.getByRole("menuitem", { name: "Switch to light theme" }));
    expect(mocks.setTheme).toHaveBeenCalledWith("light");
  });

  it("names the rail's button, which only shows an initial", () => {
    render(<UserMenu user={USER} variant="rail" />);
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent(/^V$/);
  });

  it("names the sidebar's button even when the person's name is blank", () => {
    render(<UserMenu user={{ name: "  ", email: "van@example.com" }} variant="sidebar" />);
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  it("on a phone, the account button says it opens a dialog, and whether it is open", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} variant="sheet" />);
    const trigger = screen.getByRole("button", { name: "Account menu" });

    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Van" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("signing out goes to the sign-in page and says so", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} variant="sidebar" />);

    await openDropdown(user, "Van");
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    // Replace, so Back cannot return to the signed-in page; refresh, so the
    // router cache holds nothing of the person who just left.
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/sign-in"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({ tone: "success", title: "Signed out." });
  });

  it("a refused sign-out says what to do and stays put", async () => {
    const user = userEvent.setup();
    mocks.signOut.mockResolvedValue({ data: null, error: { message: "server" } });
    render(<UserMenu user={USER} variant="sidebar" />);

    await openDropdown(user, "Van");
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        tone: "error",
        title: "Couldn't sign out.",
        description: "Check your connection and try again.",
      }),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("on a phone, opens a sheet with the same choices", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} variant="sheet" />);

    await openSheet(user);

    expect(screen.getByText("van@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("repeated taps send one sign-out request", async () => {
    const user = userEvent.setup();
    mocks.signOut.mockReturnValue(new Promise(() => {}));
    render(<UserMenu user={USER} variant="sheet" />);

    await openSheet(user);
    const button = screen.getByRole("button", { name: "Sign out" });
    await user.click(button);
    await user.click(button);

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(button).toHaveTextContent("Signing out…");
  });

  it("an offline sign-out recovers", async () => {
    const user = userEvent.setup();
    mocks.signOut.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<UserMenu user={USER} variant="sheet" />);

    await openSheet(user);
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" })),
    );
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toBeEnabled();

    await user.click(button);
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
  });
});
