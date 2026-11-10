import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { cornerFit } from "@/lib/layout/curve-snap";
import { fixture, store } from "@/lib/layout/test-layouts";
import type { Fixture } from "@/lib/layout/types";

import { CornerFit } from "./corner-fit";

const bay = (id: string, over: Partial<Fixture> = {}) => fixture({ id, type: "wall_bay", name: id, width: 48, depth: 24, rotation: 0, ...over });
// An inside corner at (200, 0) between a (along the top) and b (down the side).
const a = bay("a", { x: 100, y: 12 });
const b = bay("b", { x: 188, y: 124, rotation: 90 });

describe("CornerFit (run joins spec §3.2)", () => {
  it("bends the bay into the corner in one tap, and says it stops short of the farther bay", async () => {
    const f = bay("f", { x: 170, y: 30, width: 96 });
    const layout = { ...store(), fixtures: [a, b, f] };
    const dispatch = vi.fn();
    render(<CornerFit layout={layout} fixture={f} dispatch={dispatch} />);
    await userEvent.click(screen.getByRole("button", { name: "Fit to corner" }));
    const fit = cornerFit(layout, "f");
    if (!fit || "refusal" in fit) throw new Error("no fit");
    expect(dispatch).toHaveBeenCalledWith({ type: "command", command: { type: "updateFixture", id: "f", changes: fit.changes } });
    expect(screen.getByText(/stops .* short of the farther one/)).toBeInTheDocument();
  });

  it("shows nothing away from a corner", () => {
    const f = bay("f", { x: 400, y: 300 });
    const { container } = render(<CornerFit layout={{ ...store(), fixtures: [a, b, f] }} fixture={f} dispatch={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
