import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import type { GridItem } from "./grid-items";
import { ProductSheet } from "./product-sheet";

const pant: GridItem = { id: "p1", faceId: "u", productId: "pant", productName: "High-Rise Pant", styleNumber: "HR-1", presentation: "folded", pieceCount: 6, col: 0, row: 0, colSpan: 2, rowSpan: 2, imageKey: null, categoryName: "Denim" };

describe("ProductSheet", () => {
  it("shows the product, its cells on one line, and a way to find it in Search", () => {
    render(<ProductSheet open item={pant} onClose={vi.fn()} />);
    expect(screen.getByText("HR-1")).toBeInTheDocument();
    expect(screen.getByText("A1–B2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find in Search" })).toHaveAttribute("href", "/search?q=HR-1");
  });

  it("holds the editor while editing", () => {
    render(<ProductSheet open item={pant} onClose={vi.fn()}><p>editor</p></ProductSheet>);
    expect(screen.getByText("editor")).toBeInTheDocument();
  });

  it("closes from its close button", async () => {
    const onClose = vi.fn();
    render(<ProductSheet open item={pant} onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("hands focus back to the tile that opened it, on Close and on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const tile = screen.getByRole("button", { name: "Pant tile" });
    await user.click(tile);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(tile).toHaveFocus();

    await user.click(tile);
    await user.click(screen.getByRole("link", { name: "Find in Search" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(tile).toHaveFocus();
  });

  it("hands focus back to the card when there is no tile (an orphan)", async () => {
    const user = userEvent.setup();
    render(<Harness tile={false} />);
    const card = screen.getByRole("button", { name: "Pant card" });
    await user.click(card);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(card).toHaveFocus();
  });
});

/** A tile or card that opens the sheet, as the planogram body does. */
function Harness({ tile = true }: { tile?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {tile ? (
        <button type="button" data-placement="p1" onClick={() => setOpen(true)}>
          Pant tile
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)}>
          Pant card
        </button>
      )}
      <ProductSheet open={open} item={open ? pant : null} onClose={() => setOpen(false)} />
    </>
  );
}
