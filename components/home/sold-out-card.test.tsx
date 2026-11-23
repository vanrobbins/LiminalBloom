import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { SoldOutCard } from "./sold-out-card";

describe("SoldOutCard", () => {
  it("is a region named by its title, with one link to the sold-out products that are on the floor", () => {
    render(<SoldOutCard soldOut={{ products: 12 }} />);
    expect(screen.getByRole("heading", { level: 2, name: "Sold out on display" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "12 sold-out products still on display" });
    expect(link).toHaveAttribute("href", "/products?status=sold_out&place=floor");
  });

  it("uses the singular for one", () => {
    render(<SoldOutCard soldOut={{ products: 1 }} />);
    expect(screen.getByRole("link", { name: "1 sold-out product still on display" })).toBeInTheDocument();
  });

  it("has no see-all link: the row is the way out", () => {
    render(<SoldOutCard soldOut={{ products: 2 }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
