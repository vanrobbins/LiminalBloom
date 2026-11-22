import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import type { SetupRow } from "@/lib/home/types";

import { SetupCard } from "./setup-card";

const ROWS: SetupRow[] = [
  { key: "layout", label: "Draw the store layout", href: "/layout/edit" },
  { key: "product", label: "Add the first product", href: "/products/new" },
  { key: "team", label: "Invite your team", href: "/store" },
];

describe("SetupCard", () => {
  it("is named Set up the store", () => {
    render(<SetupCard rows={ROWS} />);
    expect(screen.getByRole("heading", { level: 2, name: "Set up the store" })).toBeInTheDocument();
  });

  it("shows one linked row per step, in the order given", () => {
    render(<SetupCard rows={ROWS} />);
    expect(screen.getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Draw the store layout", "/layout/edit"],
      ["Add the first product", "/products/new"],
      ["Invite your team", "/store"],
    ]);
  });

  it("shows only the steps it is given", () => {
    render(<SetupCard rows={[ROWS[2]]} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("Draw the store layout")).toBeNull();
  });

  it("has no see-all link: each step is the way out", () => {
    render(<SetupCard rows={ROWS} />);
    expect(screen.queryByRole("link", { name: /^All / })).toBeNull();
  });
});
