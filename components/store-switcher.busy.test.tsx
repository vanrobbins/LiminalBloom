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
    expect(mocks.toast).not.toHaveBeenCalled();
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
