import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StoreName } from "./store-menu";

const STORES = [
  { id: "store-a", name: "Pioneer Place" },
  { id: "store-b", name: "Washington Square" },
];

// Switching stores lives in the account menu: see user-menu.test.tsx.
describe("StoreName", () => {
  it("is the current store's name on one line, whole in its title, at the sizes that show it", () => {
    for (const variant of ["sheet", "name"] as const) {
      const { unmount } = render(<StoreName stores={STORES} activeStoreId="store-a" variant={variant} />);
      const name = screen.getByText("Pioneer Place");
      expect(name).toHaveAttribute("data-store-current", "Pioneer Place");
      expect(name).toHaveAttribute("data-store-label");
      expect(name).toHaveAttribute("title", "Pioneer Place");
      expect(name).toHaveClass("truncate");
      unmount();
    }
  });

  it("follows the active store", () => {
    render(<StoreName stores={STORES} activeStoreId="store-b" variant="name" />);
    expect(screen.getByText("Washington Square")).toHaveAttribute("data-store-current", "Washington Square");
  });

  it("shows initials on the rail, where the full name does not fit, and says the full name to screen readers", () => {
    render(<StoreName stores={STORES} activeStoreId="store-a" variant="initials" />);
    const name = document.querySelector("[data-store-current]")!;
    expect(name).toHaveAttribute("data-store-current", "Pioneer Place");
    expect(name).toHaveTextContent("PPPioneer Place");
    expect(screen.getByText("PP")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Pioneer Place")).toHaveClass("sr-only");
  });

  it("is plain text, never a button", () => {
    for (const variant of ["sheet", "initials", "name"] as const) {
      const { unmount } = render(<StoreName stores={STORES} activeStoreId="store-a" variant={variant} />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      unmount();
    }
  });
});
