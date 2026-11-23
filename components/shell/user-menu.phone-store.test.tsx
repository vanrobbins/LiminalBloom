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

describe("UserMenu store switch on a phone", () => {
  it("on a phone, the account sheet offers Switch store as a second step, with the stores and a way back", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sheet" />);

    const sheet = await openSheet(user);
    // The first step has no list of stores.
    expect(within(sheet).queryByRole("radiogroup")).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Switch store" }));

    const second = await screen.findByRole("dialog", { name: "Switch store" });
    const list = within(second).getByRole("radiogroup", { name: "Stores" });
    expect(within(list).getByRole("radio", { name: "Pioneer Place" })).toBeChecked();
    expect(within(second).getByRole("link", { name: "New store" })).toHaveAttribute("href", "/create-store");
    expect(within(second).queryByRole("link", { name: "Account" })).not.toBeInTheDocument();

    await user.click(within(second).getByRole("button", { name: "Back" }));

    const first = await screen.findByRole("dialog", { name: "Van" });
    expect(within(first).getByRole("link", { name: "Account" })).toBeInTheDocument();
    expect(within(first).queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("on a phone, the sheet closes once the switch goes through", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sheet" />);

    const second = await openStoreStep(user);
    await user.click(within(second).getByRole("radio", { name: "Washington Square" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.setActive).toHaveBeenCalledWith({ organizationId: "store-b" });
  });

  it("on a phone, closing the sheet on the store step reopens it at the first step", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sheet" />);

    await openStoreStep(user);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(await openSheet(user)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("on a phone, a reopened sheet cannot start a second switch before the page catches up", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sheet" />);

    const second = await openStoreStep(user);
    await user.click(within(second).getByRole("radio", { name: "Washington Square" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // activeStoreId has not changed yet: the refresh is still on its way.
    const reopened = await openStoreStep(user);
    expect(within(reopened).getByRole("radio", { name: "Switching…" })).toBeInTheDocument();
    await user.click(within(reopened).getByRole("radio", { name: "Pioneer Place" }));

    expect(mocks.setActive).toHaveBeenCalledTimes(1);
  });

  it("keeps the sheet open when a switch fails, so the person can try again", async () => {
    const user = userEvent.setup();
    mocks.setActive.mockResolvedValue({ error: { message: "network" } });
    render(<UserMenu user={USER} {...STORE_PROPS} variant="sheet" />);

    const second = await openStoreStep(user);
    await user.click(within(second).getByRole("radio", { name: "Washington Square" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" })));
    expect(screen.getByRole("dialog", { name: "Switch store" })).toBeInTheDocument();
  });
});
