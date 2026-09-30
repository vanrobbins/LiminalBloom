import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it.each([
    ["in_stock", "In stock"],
    ["sold_out", "Sold out"],
    ["on_sale", "On sale"],
  ] as const)("always shows the word for %s", (status, word) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(word)).toBeVisible();
  });

  it("hides its icon from screen readers, since the word says it", () => {
    const { container } = render(<StatusBadge status="sold_out" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("colors itself from the status tone, never gold", () => {
    const { container } = render(<StatusBadge status="sold_out" />);
    const badge = container.querySelector("[data-status]")!;
    expect(badge).toHaveAttribute("data-status", "sold_out");
    expect(badge.className).toContain("text-danger");
    expect(badge.className).not.toMatch(/brand/);
  });
});
