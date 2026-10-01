import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setActive: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { setActive: mocks.setActive } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { StoreMenu } from "./store-menu";

const STORES = [
  { id: "store-a", name: "Pioneer Place" },
  { id: "store-b", name: "Washington Square" },
];

async function openDropdown(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole("button", { name: "Pioneer Place, switch store" }).focus();
  await user.keyboard("{Enter}");
  return screen.findByRole("menu");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setActive.mockResolvedValue({ error: null });
});

describe("StoreMenu", () => {
  it("names its button for the current store, at every size", () => {
    for (const variant of ["sheet", "initials", "name"] as const) {
      const { unmount } = render(
        <StoreMenu stores={STORES} activeStoreId="store-a" variant={variant} />,
      );
      const button = screen.getByRole("button", { name: "Pioneer Place, switch store" });
      expect(button).toHaveAttribute("data-store-trigger", "Pioneer Place");
      unmount();
    }
  });

  it("shows initials on the rail, where the full name does not fit", () => {
    render(<StoreMenu stores={STORES} activeStoreId="store-a" variant="initials" />);
    expect(screen.getByRole("button", { name: "Pioneer Place, switch store" })).toHaveTextContent(
      /^PP$/,
    );
  });

  it("drops down every store, the current one checked, and a way to add one", async () => {
    const user = userEvent.setup();
    render(<StoreMenu stores={STORES} activeStoreId="store-a" variant="name" />);

    await openDropdown(user);

    expect(screen.getByRole("menuitemradio", { name: "Pioneer Place" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Washington Square" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("menuitem", { name: "New store" })).toHaveAttribute(
      "href",
      "/create-store",
    );
  });

  it("with one store, still lists it and offers a new one", async () => {
    const user = userEvent.setup();
    render(<StoreMenu stores={[STORES[0]]} activeStoreId="store-a" variant="name" />);

    await openDropdown(user);

    expect(screen.getAllByRole("menuitemradio")).toHaveLength(1);
    expect(screen.getByRole("menuitem", { name: "New store" })).toBeInTheDocument();
  });

  it("switches when another store is chosen from the dropdown", async () => {
    const user = userEvent.setup();
    render(<StoreMenu stores={STORES} activeStoreId="store-a" variant="name" />);

    await openDropdown(user);
    await user.click(screen.getByRole("menuitemradio", { name: "Washington Square" }));

    expect(mocks.setActive).toHaveBeenCalledWith({ organizationId: "store-b" });
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        tone: "success",
        title: "Now working in Washington Square.",
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("on a phone, opens a sheet of stores that closes once the switch goes through", async () => {
    const user = userEvent.setup();
    render(<StoreMenu stores={STORES} activeStoreId="store-a" variant="sheet" />);

    await user.click(screen.getByRole("button", { name: "Pioneer Place, switch store" }));
    const sheet = await screen.findByRole("dialog", { name: "Stores" });
    const list = within(sheet).getByRole("radiogroup", { name: "Stores" });

    await user.click(within(list).getByRole("radio", { name: "Washington Square" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Stores" })).not.toBeInTheDocument(),
    );
  });

  it("on a phone, a reopened sheet cannot start a second switch before the page catches up", async () => {
    const user = userEvent.setup();
    render(<StoreMenu stores={STORES} activeStoreId="store-a" variant="sheet" />);
    const trigger = screen.getByRole("button", { name: "Pioneer Place, switch store" });

    await user.click(trigger);
    const sheet = await screen.findByRole("dialog", { name: "Stores" });
    await user.click(within(sheet).getByRole("radio", { name: "Washington Square" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Stores" })).not.toBeInTheDocument(),
    );

    // activeStoreId has not changed yet: the refresh is still on its way.
    await user.click(trigger);
    const reopened = await screen.findByRole("dialog", { name: "Stores" });
    expect(within(reopened).getByRole("radio", { name: "Switching…" })).toBeInTheDocument();
    await user.click(within(reopened).getByRole("radio", { name: "Pioneer Place" }));

    expect(mocks.setActive).toHaveBeenCalledTimes(1);
  });

  it("on a phone, the sheet button says it opens a dialog, and whether it is open", async () => {
    const user = userEvent.setup();
    render(<StoreMenu stores={STORES} activeStoreId="store-a" variant="sheet" />);
    const trigger = screen.getByRole("button", { name: "Pioneer Place, switch store" });

    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Stores" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the sheet open when a switch fails, so the person can try again", async () => {
    const user = userEvent.setup();
    mocks.setActive.mockResolvedValue({ error: { message: "network" } });
    render(<StoreMenu stores={STORES} activeStoreId="store-a" variant="sheet" />);

    await user.click(screen.getByRole("button", { name: "Pioneer Place, switch store" }));
    const sheet = await screen.findByRole("dialog", { name: "Stores" });
    await user.click(within(sheet).getByRole("radio", { name: "Washington Square" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" })),
    );
    expect(screen.getByRole("dialog", { name: "Stores" })).toBeInTheDocument();
  });
});
