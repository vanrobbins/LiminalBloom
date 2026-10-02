import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OutlineSetup } from "./outline-setup";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("OutlineSetup", () => {
  it("creates a rectangle from width and depth", async () => {
    const dispatch = vi.fn();
    render(<OutlineSetup dispatch={dispatch} />);
    const width = screen.getByRole("textbox", { name: "Width, feet" });
    await userEvent.clear(width);
    await userEvent.type(width, "50");
    await userEvent.click(screen.getByRole("button", { name: "Create outline" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "setRectangle", width: 600, depth: 360 });
  });

  it("uses what is typed even when the field never lost focus (iOS button taps)", async () => {
    const dispatch = vi.fn();
    render(<OutlineSetup dispatch={dispatch} />);
    const depth = screen.getByRole("textbox", { name: "Depth, feet" });
    await userEvent.clear(depth);
    await userEvent.type(depth, "25");
    // fireEvent does not move focus, so the field's own blur commit never runs.
    fireEvent.click(screen.getByRole("button", { name: "Create outline" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "setRectangle", width: 480, depth: 300 });
  });

  it("does not create an outline from a typo", async () => {
    const dispatch = vi.fn();
    render(<OutlineSetup dispatch={dispatch} />);
    const depth = screen.getByRole("textbox", { name: "Depth, feet" });
    await userEvent.clear(depth);
    await userEvent.type(depth, "2x");
    fireEvent.click(screen.getByRole("button", { name: "Create outline" }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("starts drawing for a custom shape", async () => {
    const dispatch = vi.fn();
    render(<OutlineSetup dispatch={dispatch} />);
    await userEvent.click(screen.getByRole("button", { name: "Draw it corner by corner" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "startDrawing" });
  });
});
