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
    expect(link("Account")).toHaveAttribute("href", "/account");
  });

  it("marks only the page being shown", () => {
    render(<NavLinks variant="sidebar" />);
    expect(link("Products")).toHaveAttribute("aria-current", "page");
    expect(link("Account")).not.toHaveAttribute("aria-current");
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
      expect(link("Account").className).not.toMatch(/\b(bg-brand|border-brand)\b/);
      unmount();
    }
  });

  it("makes every entry a touch target of at least 44 px", () => {
    for (const variant of ["tabs", "rail", "sidebar"] as const) {
      const { unmount } = render(<NavLinks variant={variant} />);
      expect(link("Account").className).toMatch(/\bmin-h-(11|14)\b/);
      unmount();
    }
  });
});
