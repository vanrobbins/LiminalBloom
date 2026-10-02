import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { BottomSheet } from "./bottom-sheet";

describe("BottomSheet", () => {
  it("opens as a dialog named by its title", () => {
    render(
      <BottomSheet open onOpenChange={() => {}} title="Straight jean">
        <p>Details</p>
      </BottomSheet>,
    );
    expect(screen.getByRole("dialog", { name: "Straight jean" })).toBeVisible();
    expect(screen.getByText("Details")).toBeVisible();
  });

  it("in peek mode, leaves the page usable: no scrim, no lock, focus stays put", () => {
    const page = (open: boolean) => (
      <>
        <button type="button">Map</button>
        <BottomSheet open={open} onOpenChange={() => {}} title="Table 2" peek>
          <p>Properties</p>
        </BottomSheet>
      </>
    );
    const { rerender } = render(page(false));
    const map = screen.getByRole("button", { name: "Map" });
    map.focus();
    rerender(page(true));
    expect(screen.getByRole("region", { name: "Table 2" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".bg-scrim")).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe("none");
    expect(map).not.toHaveAttribute("aria-hidden");
    expect(map).toHaveFocus();
  });

  it("in peek mode, the handle raises and lowers the panel", async () => {
    const user = userEvent.setup();
    render(
      <BottomSheet open onOpenChange={() => {}} title="Table 2" peek>
        <p>Properties</p>
      </BottomSheet>,
    );
    const panel = screen.getByRole("region", { name: "Table 2" });
    const peekHeight = panel.style.height;
    await user.click(screen.getByRole("button", { name: "Expand" }));
    const handle = screen.getByRole("button", { name: "Collapse" });
    expect(handle).toHaveAttribute("aria-expanded", "true");
    expect(panel.style.height).not.toBe(peekHeight);
    await user.click(handle);
    expect(screen.getByRole("button", { name: "Expand" })).toHaveAttribute("aria-expanded", "false");
    expect(panel.style.height).toBe(peekHeight);
  });

  it("in peek mode, swiping the handle changes the height and reopening starts low", () => {
    const sheet = (open: boolean) => (
      <BottomSheet open={open} onOpenChange={() => {}} title="Table 2" peek>
        <p>Properties</p>
      </BottomSheet>
    );
    const { rerender } = render(sheet(true));
    const up = screen.getByRole("button", { name: "Expand" });
    fireEvent.pointerDown(up, { clientY: 500 });
    fireEvent.pointerUp(up, { clientY: 300 });
    fireEvent.click(up);
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveAttribute("aria-expanded", "true");
    rerender(sheet(false));
    rerender(sheet(true));
    expect(screen.getByRole("button", { name: "Expand" })).toHaveAttribute("aria-expanded", "false");
  });

  it.each([true, false])("commits a field being typed in before closing (peek: %s)", (peek) => {
    const order: string[] = [];
    render(
      <BottomSheet open onOpenChange={() => order.push("close")} title="Table 2" peek={peek}>
        <input aria-label="Name" onBlur={() => order.push("blur")} />
      </BottomSheet>,
    );
    screen.getByRole("textbox", { name: "Name" }).focus();
    // fireEvent does not move focus, as an iOS button tap may not.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(order).toEqual(["blur", "close"]);
  });

  it("in peek mode, closes on Escape from inside and from Close", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="Table 2" peek>
        <button type="button">Inside</button>
      </BottomSheet>,
    );
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "Inside" }).focus();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("keeps a hidden title for screen readers", () => {
    render(
      <BottomSheet open onOpenChange={() => {}} title="Filters" hideTitle>
        <p>Details</p>
      </BottomSheet>,
    );
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  });

  it("asks to close on Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="Straight jean">
        <p>Details</p>
      </BottomSheet>,
    );
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks to close from its Close button", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="Straight jean">
        <p>Details</p>
      </BottomSheet>,
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("moves focus into the sheet, and back to what opened it on close", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Straight jean
          </button>
          <BottomSheet open={open} onOpenChange={setOpen} title="Straight jean">
            <p>Details</p>
          </BottomSheet>
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Straight jean" });

    await user.click(opener);
    const sheet = await screen.findByRole("dialog", { name: "Straight jean" });
    // A screen reader hears the sheet only if focus is inside it.
    await waitFor(() => expect(sheet).toContainElement(document.activeElement as HTMLElement));

    // Closed from inside, not by Escape straight away, so "returned" cannot
    // be confused with "never left".
    screen.getByRole("button", { name: "Close" }).focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener).toHaveFocus();
  });

  it("renders nothing while closed", () => {
    render(
      <BottomSheet open={false} onOpenChange={() => {}} title="Straight jean">
        <p>Details</p>
      </BottomSheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
