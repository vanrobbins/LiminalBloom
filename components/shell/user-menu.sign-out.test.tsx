import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  setActive: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  setTheme: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: mocks.signOut, organization: { setActive: mocks.setActive } } }));
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
const STORES = [
  { id: "store-a", name: "Pioneer Place" },
  { id: "store-b", name: "Washington Square" },
];
const STORE_PROPS = { stores: STORES, activeStoreId: "store-a" };

async function openDropdown(user: ReturnType<typeof userEvent.setup>, name: string) {
  screen.getByRole("button", { name }).focus();
  await user.keyboard("{Enter}");
  return screen.findByRole("menu");
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Account menu" }));
  return screen.findByRole("dialog", { name: "Van" });
}

/** In the open dropdown, opens the "Switch store" submenu. */
async function openStores(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("menuitem", { name: "Switch store" }));
  return screen.findByRole("menuitemradio", { name: "Pioneer Place" });
}

/** On the phone, opens the sheet and goes on to its "Switch store" step. */
async function openStoreStep(user: ReturnType<typeof userEvent.setup>) {
  const sheet = await openSheet(user);
  await user.click(within(sheet).getByRole("button", { name: "Switch store" }));
  return screen.findByRole("dialog", { name: "Switch store" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
  mocks.setActive.mockResolvedValue({ error: null });
});

describe("UserMenu sign out", () => {
  it("signing out goes to the sign-in page, with no toast: the sign-in page is the feedback", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sidebar" />);

    await openDropdown(user, "Van");
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    // Replace, so Back cannot return to the signed-in page; refresh, so the
    // router cache holds nothing of the person who just left.
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/sign-in"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("signing out forgets this browser's recent palette picks, so a shared tablet never shows the last person's", async () => {
    localStorage.setItem("liminal-bloom:palette-recent:u1:s1", "[]");
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sidebar" />);
    await openDropdown(user, "Van");
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/sign-in"));
    expect(localStorage.getItem("liminal-bloom:palette-recent:u1:s1")).toBeNull();
  });

  it("a refused sign-out keeps them", async () => {
    localStorage.setItem("liminal-bloom:palette-recent:u1:s1", "[]");
    mocks.signOut.mockResolvedValue({ data: null, error: { message: "server" } });
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sidebar" />);
    await openDropdown(user, "Van");
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(localStorage.getItem("liminal-bloom:palette-recent:u1:s1")).toBe("[]");
  });

  it("a refused sign-out says what to do and stays put", async () => {
    const user = userEvent.setup();
    mocks.signOut.mockResolvedValue({ data: null, error: { message: "server" } });
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sidebar" />);

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
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sheet" />);

    await openSheet(user);

    expect(screen.getByText("van@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(screen.queryByRole("link", { name: "Store settings" })).toBeNull();
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("repeated taps send one sign-out request", async () => {
    const user = userEvent.setup();
    mocks.signOut.mockReturnValue(new Promise(() => {}));
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sheet" />);

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
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sheet" />);

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
