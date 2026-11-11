import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Fold } from "./fold";

describe("Fold", () => {
  it("shows one line naming the part and what it is set to, and keeps the rest out of the page", () => {
    render(
      <Fold title="Curve" summary="Straight" open={false} onToggle={vi.fn()}>
        <p>Inside</p>
      </Fold>,
    );
    expect(screen.getByRole("button", { name: "Curve Straight" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Inside")).toBeNull();
  });

  it("shows what is inside when open, and asks to toggle on a press", async () => {
    const onToggle = vi.fn();
    render(
      <Fold title="Curve" open onToggle={onToggle}>
        <p>Inside</p>
      </Fold>,
    );
    const line = screen.getByRole("button", { name: "Curve" });
    expect(line).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Inside")).toBeInTheDocument();
    await userEvent.click(line);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
