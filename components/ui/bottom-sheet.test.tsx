import { render, screen, waitFor } from "@testing-library/react";
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
