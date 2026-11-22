import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/products" }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { NavLinks } from "./nav-links";

function link(name: string) {
  return within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name });
}

beforeEach(() => {
  mocks.pathname = "/products";
});

describe("NavLinks", () => {
  it("puts Home first, then Products, and has no separate Search or Account entry", () => {
    render(<NavLinks variant="tabs" />);
    const links = within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link");
    expect(links[0]).toHaveAccessibleName("Home");
    expect(links.map((l) => l.textContent)).toEqual(["Home", "Products", "Layout", "Planograms", "Store"]);
  });

  it("leaves Account to the avatar menu, so five tabs fit a 360 px phone", () => {
    render(<NavLinks variant="tabs" />);
    expect(within(screen.getByRole("navigation", { name: "Main" })).queryByRole("link", { name: "Account" })).toBeNull();
  });

  it("is current on /home", () => {
    mocks.pathname = "/home";
    render(<NavLinks variant="sidebar" />);
    expect(link("Home")).toHaveAttribute("href", "/home");
    expect(link("Home")).toHaveAttribute("aria-current", "page");
    expect(link("Products")).not.toHaveAttribute("aria-current");
  });

  it("is the main navigation landmark, in every form", () => {
    for (const variant of ["tabs", "rail", "sidebar"] as const) {
      const { unmount } = render(<NavLinks variant={variant} />);
      expect(screen.getByRole("navigation", { name: "Main" })).toHaveAttribute(
        "data-nav",
        variant,
      );
      unmount();
    }
  });

  it("labels every entry in words, not just an icon", () => {
    render(<NavLinks variant="rail" />);
    expect(link("Products")).toHaveAttribute("href", "/products");
    expect(link("Layout")).toHaveAttribute("href", "/layout");
    expect(link("Planograms")).toHaveAttribute("href", "/planograms");
  });

  it("lists Store in every form, after Planograms, current on /store and on /store/roles", () => {
    for (const pathname of ["/store", "/store/roles"]) {
      mocks.pathname = pathname;
      for (const variant of ["tabs", "rail", "sidebar"] as const) {
        const { unmount } = render(<NavLinks variant={variant} />);
        expect(link("Store")).toHaveAttribute("href", "/store");
        expect(link("Store")).toHaveAttribute("aria-current", "page");
        expect(link("Planograms")).not.toHaveAttribute("aria-current");
        unmount();
      }
    }
  });

  it("has no People entry: the people live in the Store panel", () => {
    render(<NavLinks variant="tabs" />);
    expect(within(screen.getByRole("navigation", { name: "Main" })).queryByRole("link", { name: "People" })).toBeNull();
  });

  it("marks only the page being shown", () => {
    render(<NavLinks variant="sidebar" />);
    expect(link("Products")).toHaveAttribute("aria-current", "page");
    expect(link("Store")).not.toHaveAttribute("aria-current");
  });

  it("still marks an entry on a page beneath it", () => {
    mocks.pathname = "/products/abc";
    render(<NavLinks variant="sidebar" />);
    expect(link("Products")).toHaveAttribute("aria-current", "page");
  });

  it("does not mark an entry that only shares the start of the path", () => {
    mocks.pathname = "/productsx";
    render(<NavLinks variant="sidebar" />);
    expect(link("Products")).not.toHaveAttribute("aria-current");
  });

  it("shows the current entry in gold, the current selection (§5.5)", () => {
    for (const variant of ["tabs", "rail", "sidebar"] as const) {
      const { unmount } = render(<NavLinks variant={variant} />);
      expect(link("Products").className).toMatch(/\b(bg-brand|border-brand)\b/);
      expect(link("Store").className).not.toMatch(/\b(bg-brand|border-brand)\b/);
      unmount();
    }
  });

  it("makes every entry a touch target of at least 44 px", () => {
    for (const variant of ["tabs", "rail", "sidebar"] as const) {
      const { unmount } = render(<NavLinks variant={variant} />);
      expect(link("Home").className).toMatch(/\bmin-h-(11|14)\b/);
      unmount();
    }
  });
});
