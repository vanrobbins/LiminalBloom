import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { hexToOklch } from "@/lib/products/colors";

import { ColorWheel, hueName } from "./color-wheel";

describe("ColorWheel", () => {
  it("names the hue and the square in words for screen readers", () => {
    render(<ColorWheel value="#1f3a5c" onChange={() => {}} />);
    expect(screen.getByRole("slider", { name: "Hue" }).getAttribute("aria-valuetext")).toMatch(/^Hue \d+°, blue$/);
    expect(screen.getByRole("slider", { name: "Lightness and chroma" }).getAttribute("aria-valuetext")).toMatch(/^Lightness \d+%, chroma 0\.\d\d$/);
  });

  it("moves 5° of hue per arrow key on the ring", () => {
    const onChange = vi.fn();
    render(<ColorWheel value="#7a2e3b" onChange={onChange} />);
    const ring = screen.getByRole("slider", { name: "Hue" });
    const before = Number(ring.getAttribute("aria-valuenow"));
    fireEvent.keyDown(ring, { key: "ArrowRight" });
    const after = Number(ring.getAttribute("aria-valuenow"));
    expect(after - Math.round(before / 5) * 5).toBe(5);
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^#[0-9a-f]{6}$/));
  });

  it("moves lightness up and down and chroma left and right on the square", () => {
    const onChange = vi.fn();
    render(<ColorWheel value="#808080" onChange={onChange} />);
    const square = screen.getByRole("slider", { name: "Lightness and chroma" });
    const l = Number(square.getAttribute("aria-valuenow"));
    fireEvent.keyDown(square, { key: "ArrowUp" });
    expect(Number(square.getAttribute("aria-valuenow"))).toBeGreaterThan(l);
    fireEvent.keyDown(square, { key: "ArrowRight" });
    expect(hexToOklch(onChange.mock.lastCall![0]).c).toBeGreaterThan(0.005);
  });

  it("takes a hex colour typed in, and says when it isn't one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorWheel value="#808080" onChange={onChange} />);
    const field = screen.getByLabelText("Hex");
    await user.clear(field);
    await user.type(field, "#1F3A5C");
    expect(onChange).toHaveBeenLastCalledWith("#1f3a5c");
    await user.clear(field);
    await user.type(field, "navy");
    expect(field).toHaveAccessibleDescription("Use a colour like #1f3a5c.");
  });

  it("names hues by the nearest family", () => {
    expect([10, 30, 90, 150, 200, 250, 300, 355].map(hueName)).toEqual(["red", "red", "yellow", "green", "teal", "blue", "purple", "pink"]);
  });
});
