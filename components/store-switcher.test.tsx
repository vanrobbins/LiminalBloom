import { render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { StoreSwitcher } from "./store-switcher";

const STORES = [
  { id: "store-a", name: "Pioneer Place" },
  { id: "store-b", name: "Washington Square" },
];

function store(name: string) {
  return screen.getByRole("radiogroup", { name: "Stores" }).querySelector(
    `button[data-store-name="${name}"]`,
  ) as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setActive.mockResolvedValue({ error: null });
});

describe("StoreSwitcher", () => {
  it("marks the store being worked in", () => {
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);
    expect(store("Pioneer Place")).toHaveAttribute("data-state", "on");
    expect(store("Washington Square")).toHaveAttribute("data-state", "off");
    // Announced as the chosen one of a set, not just a pressed button.
    expect(screen.getByRole("radio", { name: "Pioneer Place" })).toBeChecked();
  });

  it("lists stores top to bottom, moved through with the up and down arrows", async () => {
    const user = userEvent.setup();
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);

    expect(screen.getByRole("radiogroup", { name: "Stores" })).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    await user.tab();
    expect(store("Pioneer Place")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(store("Washington Square")).toHaveFocus();
  });

  it("switches, confirms with a toast, and re-renders the page", async () => {
    const user = userEvent.setup();
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);

    await user.click(store("Washington Square"));

    expect(mocks.setActive).toHaveBeenCalledWith({ organizationId: "store-b" });
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        tone: "success",
        title: "Now working in Washington Square.",
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("says what to do when a switch fails, and stays put", async () => {
    const user = userEvent.setup();
    mocks.setActive.mockResolvedValue({ error: { message: "network" } });
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);

    await user.click(store("Washington Square"));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        tone: "error",
        title: "Couldn't switch stores.",
        description: "Check your connection and try again.",
      }),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("does nothing when the current store is tapped", async () => {
    const user = userEvent.setup();
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);

    await user.click(store("Pioneer Place"));

    expect(mocks.setActive).not.toHaveBeenCalled();
  });

  it("ignores taps while a switch is in flight", async () => {
    const user = userEvent.setup();
    mocks.setActive.mockReturnValue(new Promise(() => {}));
    render(
      <StoreSwitcher
        stores={[...STORES, { id: "store-c", name: "Lloyd Center" }]}
        activeStoreId="store-a"
      />,
    );

    await user.click(store("Washington Square"));
    await user.click(store("Lloyd Center"));

    expect(mocks.setActive).toHaveBeenCalledTimes(1);
  });

  it("stays busy until the page shows the new store, then takes taps again", async () => {
    const user = userEvent.setup();
    const stores = [...STORES, { id: "store-c", name: "Lloyd Center" }];
    const { rerender } = render(<StoreSwitcher stores={stores} activeStoreId="store-a" />);

    await user.click(store("Washington Square"));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());

    // setActive has answered but the page has not re-rendered yet: the old
    // store is still the active one. Taps now must not start a second switch.
    await user.click(store("Washington Square"));
    await user.click(store("Lloyd Center"));
    expect(mocks.setActive).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(store("Washington Square")).toHaveTextContent("Switching…");

    // The refreshed page arrives with the new store active.
    rerender(<StoreSwitcher stores={stores} activeStoreId="store-b" />);
    expect(store("Washington Square")).toHaveTextContent("Washington Square");

    await user.click(store("Lloyd Center"));
    expect(mocks.setActive).toHaveBeenCalledTimes(2);
  });

  it("stops being busy when the page arrives with a different store than requested", async () => {
    const user = userEvent.setup();
    const stores = [...STORES, { id: "store-c", name: "Lloyd Center" }];
    const { rerender } = render(<StoreSwitcher stores={stores} activeStoreId="store-a" />);

    await user.click(store("Washington Square"));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(store("Washington Square")).toHaveTextContent("Switching…");

    // Membership fell back to another store than the one asked for.
    rerender(<StoreSwitcher stores={stores} activeStoreId="store-c" />);
    expect(store("Washington Square")).toHaveTextContent("Washington Square");

    await user.click(store("Pioneer Place"));
    expect(mocks.setActive).toHaveBeenCalledTimes(2);
  });

  it("recovers when the request itself fails, as it does offline", async () => {
    const user = userEvent.setup();
    mocks.setActive.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);

    await user.click(store("Washington Square"));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        tone: "error",
        title: "Couldn't switch stores.",
        description: "Check your connection and try again.",
      }),
    );
    expect(store("Washington Square")).toHaveTextContent("Washington Square");

    // Not stuck: the next tap tries again.
    await user.click(store("Washington Square"));
    expect(mocks.setActive).toHaveBeenCalledTimes(2);
  });

  it("tells its container once a switch goes through, and not when it fails", async () => {
    const user = userEvent.setup();
    const onSwitched = vi.fn();
    const { unmount } = render(
      <StoreSwitcher stores={STORES} activeStoreId="store-a" onSwitched={onSwitched} />,
    );

    await user.click(store("Washington Square"));
    await waitFor(() => expect(onSwitched).toHaveBeenCalledTimes(1));
    unmount();

    mocks.setActive.mockResolvedValue({ error: { message: "network" } });
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" onSwitched={onSwitched} />);
    await user.click(store("Washington Square"));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenLastCalledWith(expect.objectContaining({ tone: "error" })),
    );
    expect(onSwitched).toHaveBeenCalledTimes(1);
  });

  it("links to creating a new store", () => {
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);
    expect(screen.getByRole("link", { name: "New store" })).toHaveAttribute(
      "href",
      "/create-store",
    );
  });
});
