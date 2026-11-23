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

describe("UserMenu", () => {
  it("shows who is signed in, links to Account, and offers the other theme", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sidebar" />);

    await openDropdown(user, "Van");

    expect(screen.getByText("van@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(screen.queryByRole("menuitem", { name: "Store settings" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Switch to light theme" }));
    expect(mocks.setTheme).toHaveBeenCalledWith("light");
  });

  it("names the rail's button, which only shows an initial", () => {
    render(<UserMenu user={USER} {...STORE_PROPS} variant="rail" />);
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent(/^V$/);
  });

  it("names the sidebar's button even when the person's name is blank", () => {
    render(<UserMenu user={{ name: "  ", email: "van@example.com" }} {...STORE_PROPS} variant="sidebar" />);
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  it("on a phone, the account button says it opens a dialog, and whether it is open", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sheet" />);
    const trigger = screen.getByRole("button", { name: "Account menu" });

    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Van" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("offers Switch store as a submenu of every store, the current one checked, and a way to add one", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sidebar" />);

    await openDropdown(user, "Van");
    // Closed until asked: the list is a second step, not part of the menu.
    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    await openStores(user);

    expect(screen.getByRole("menuitemradio", { name: "Pioneer Place" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Washington Square" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitem", { name: "New store" })).toHaveAttribute("href", "/create-store");
  });

  it("opens the store submenu from the keyboard", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="rail" />);

    await openDropdown(user, "Account menu");
    screen.getByRole("menuitem", { name: "Switch store" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(await screen.findByRole("menuitemradio", { name: "Pioneer Place" })).toBeInTheDocument();
  });

  it("with several stores, Account and Sign out stay in the top menu: the list lives only in the submenu", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `Store ${i}` }));
    render(<UserMenu user={USER} stores={many} activeStoreId="s0" variant="sidebar" />);

    await openDropdown(user, "Van");

    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Switch store",
      "Account",
      "Help",
      "Switch to light theme",
      "Sign out",
    ]);
    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Switch store" }));
    expect(await screen.findAllByRole("menuitemradio")).toHaveLength(12);
  });

  it("with one store, still lists it and offers a new one", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} stores={[STORES[0]]} activeStoreId="store-a" variant="sidebar" />);

    await openDropdown(user, "Van");
    await openStores(user);

    expect(screen.getAllByRole("menuitemradio")).toHaveLength(1);
    expect(screen.getByRole("menuitem", { name: "New store" })).toBeInTheDocument();
  });

  it("switches when another store is chosen from the submenu", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sidebar" />);

    await openDropdown(user, "Van");
    await openStores(user);
    // By keyboard: jsdom has no pointer geometry for the submenu's pointer-grace area.
    screen.getByRole("menuitemradio", { name: "Washington Square" }).focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(mocks.setActive).toHaveBeenCalledWith({ organizationId: "store-b" }));
    // The header's store name is the feedback: no "Now working in" toast.
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
