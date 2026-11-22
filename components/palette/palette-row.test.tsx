import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Moon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import type { PaletteItem } from "@/lib/palette/types";

import { PaletteRow } from "./palette-row";

const product = (over: Partial<Extract<PaletteItem, { kind: "product" }>> = {}): PaletteItem => ({
  kind: "product", id: "product:p1", label: "Navy Tee", keywords: "", styleNumber: "NT-104", status: "in_stock", place: "Front table", more: 0, href: "/products", ...over,
});
const draw = (item: PaletteItem, active = false, onPick = vi.fn(), onHover = vi.fn()) => {
  render(<PaletteRow item={item} id="row" active={active} onPick={onPick} onHover={onHover} />);
  return { onPick, onHover };
};

describe("PaletteRow", () => {
  it("a product shows its style number, where it is and no badge when in stock", () => {
    draw(product());
    expect(screen.getByRole("option")).toHaveTextContent("Navy TeeNT-104 · Front table");
    expect(screen.queryByText("In stock")).not.toBeInTheDocument();
  });

  it("a product that is not in stock shows its word, and 'Not placed' and '+2 more' read plainly", () => {
    draw(product({ status: "sold_out", place: null, more: 2 }));
    expect(screen.getByText("Sold out")).toBeVisible();
    expect(screen.getByRole("option")).toHaveTextContent("Not placed · +2 more");
  });

  it("a planogram shows its zone and state on the second line", () => {
    draw({ kind: "planogram", id: "planogram:f", label: "Rack 1", keywords: "", second: "Men · Draft", href: "/planograms/f" });
    expect(screen.getByRole("option")).toHaveTextContent("Rack 1Men · Draft");
  });

  it("the icon is decorative, and a command has no second line", () => {
    const { container } = render(
      <PaletteRow item={{ kind: "action", id: "action:theme", label: "Switch to dark theme", keywords: "", icon: Moon, target: { theme: true } }} id="r" active={false} onPick={vi.fn()} onHover={vi.fn()} />,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("option")).toHaveTextContent(/^Switch to dark theme$/);
  });

  it("is selected when active, picks on click, and hover asks to move the highlight", async () => {
    const { onPick, onHover } = draw(product());
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "false");
    await userEvent.hover(screen.getByRole("option"));
    expect(onHover).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("option"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "product:p1" }));
  });

  it("marks the active row", () => {
    draw(product(), true);
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
  });
});
