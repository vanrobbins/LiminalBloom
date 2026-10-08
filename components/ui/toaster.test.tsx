import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dismissToast, getToasts, toast } from "@/lib/toast";

import { Toaster } from "./toaster";

beforeEach(() => {
  for (const { id } of getToasts()) {
    dismissToast(id);
  }
});

describe("Toaster", () => {
  it("shows a toast's title and description", () => {
    render(<Toaster />);
    act(() => {
      toast({
        tone: "error",
        title: "Couldn't switch stores.",
        description: "Check your connection and try again.",
      });
    });
    expect(screen.getAllByText("Couldn't switch stores.")[0]).toBeVisible();
    expect(
      screen.getAllByText("Check your connection and try again.")[0],
    ).toBeVisible();
  });

  it("removes a toast when it is dismissed", async () => {
    const user = userEvent.setup();
    render(<Toaster />);
    act(() => {
      toast({ tone: "success", title: "Now working in Pioneer Place." });
    });

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(getToasts()).toEqual([]);
  });

  it("offers an action and closes the toast when it is chosen", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Toaster />);
    act(() => {
      toast({ tone: "success", title: "Marked sold out", action: { label: "Undo", onSelect } });
    });
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onSelect).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText("Marked sold out")).not.toBeInTheDocument());
  });
});
