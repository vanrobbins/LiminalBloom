import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  switchStore: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/app/(app)/switch-store-actions", () => ({
  switchStore: mocks.switchStore,
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
  return screen
    .getByRole("radiogroup", { name: "Stores" })
    .querySelector(`button[data-store-name="${name}"]`) as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.switchStore.mockResolvedValue({ status: "switched" });
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

  it("switches and re-renders the page, with no toast", async () => {
    const user = userEvent.setup();
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);

    await user.click(store("Washington Square"));

    expect(mocks.switchStore).toHaveBeenCalledWith("store-b");
    // The header's store name is the feedback: no "Now working in" toast.
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("says what to do when a switch fails, and stays put", async () => {
    const user = userEvent.setup();
    mocks.switchStore.mockRejectedValue(new TypeError("Failed to fetch"));
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

  it("says so when the server no longer lets the person into that store, and refreshes the list", async () => {
    const user = userEvent.setup();
    mocks.switchStore.mockResolvedValue({ status: "forbidden" });
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);

    await user.click(store("Washington Square"));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        tone: "error",
        title: "Couldn't switch stores.",
        description: "That store isn't available to you any more.",
      }),
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the current store is tapped", async () => {
    const user = userEvent.setup();
    render(<StoreSwitcher stores={STORES} activeStoreId="store-a" />);

    await user.click(store("Pioneer Place"));

    expect(mocks.switchStore).not.toHaveBeenCalled();
  });

  it("ignores taps while a switch is in flight", async () => {
    const user = userEvent.setup();
    mocks.switchStore.mockReturnValue(new Promise(() => {}));
    render(
      <StoreSwitcher
        stores={[...STORES, { id: "store-c", name: "Lloyd Center" }]}
        activeStoreId="store-a"
      />,
    );

    await user.click(store("Washington Square"));
    await user.click(store("Lloyd Center"));

    expect(mocks.switchStore).toHaveBeenCalledTimes(1);
  });
});
