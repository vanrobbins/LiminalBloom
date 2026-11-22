import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Undo2 } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { dismissToast, toast } from "@/lib/toast";

import { BottomSheet } from "./bottom-sheet";
import { Toaster } from "./toaster";

describe("BottomSheet", () => {

  it("closes from an × icon button, not a text link, in both modes (UX audit U1)", () => {
    const { rerender } = render(
      <BottomSheet open onOpenChange={() => {}} title="Straight jean">
        <p>Details</p>
      </BottomSheet>,
    );
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveTextContent("Close");
    expect(screen.getByRole("button", { name: "Close" }).querySelector("svg")).not.toBeNull();
    rerender(
      <BottomSheet open onOpenChange={() => {}} title="Straight jean" peek>
        <p>Details</p>
      </BottomSheet>,
    );
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveTextContent("Close");
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

  it("Escape closes the sheet first, even with a toast showing", async () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <Toaster />
        <BottomSheet open onOpenChange={onOpenChange} title="Straight jean">
          <p>Details</p>
        </BottomSheet>
      </>,
    );
    let id = 0;
    act(() => {
      id = toast({ tone: "success", title: "Moved", action: { label: "Undo", icon: Undo2, onSelect: () => {} } });
    });
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    act(() => dismissToast(id));
  });

  it("keeps toasts visible to assistive tech and tappable above the modal sheet", () => {
    render(
      <>
        <Toaster />
        <BottomSheet open onOpenChange={() => {}} title="Straight jean">
          <p>Details</p>
        </BottomSheet>
      </>,
    );
    act(() => {
      toast({ tone: "success", title: "Marked sold out", action: { label: "Undo", icon: Undo2, onSelect: () => {} } });
    });
    const viewport = document.querySelector("[data-toast-viewport]") as HTMLElement;
    // The sheet is modal, but its toasts are not hidden from assistive tech or the pointer.
    expect(viewport.closest("[aria-hidden='true']")).toBeNull();
    expect(screen.getByRole("button", { name: "Undo" }).closest("li")).toHaveClass("pointer-events-auto");
    expect(viewport).not.toHaveClass("pointer-events-auto");
  });
});
