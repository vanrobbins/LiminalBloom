import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { NotPlacedCard } from "./not-placed-card";

describe("NotPlacedCard", () => {
  it("has two rows, the products first, each with its own link", () => {
    render(<NotPlacedCard notPlaced={{ products: 12, fixtures: 3 }} />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["12 products not placed", "/products?place=unplaced"],
      ["3 fixtures without a planogram", "/planograms"],
    ]);
  });

  it("is a region named by its title", () => {
    render(<NotPlacedCard notPlaced={{ products: 1, fixtures: 1 }} />);
    expect(screen.getByRole("heading", { level: 2, name: "Not placed yet" })).toBeInTheDocument();
  });

  it("uses the singular for one", () => {
    render(<NotPlacedCard notPlaced={{ products: 1, fixtures: 1 }} />);
    expect(screen.getByRole("link", { name: "1 product not placed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1 fixture without a planogram" })).toBeInTheDocument();
  });

  it("leaves out a row whose count is zero", () => {
    const { rerender } = render(<NotPlacedCard notPlaced={{ products: 0, fixtures: 3 }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText(/products? not placed/)).toBeNull();
    rerender(<NotPlacedCard notPlaced={{ products: 4, fixtures: 0 }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText(/without a planogram/)).toBeNull();
  });

  it("has no see-all link: each row is the way out", () => {
    render(<NotPlacedCard notPlaced={{ products: 2, fixtures: 2 }} />);
    expect(screen.queryByRole("link", { name: /^All / })).toBeNull();
  });
});
