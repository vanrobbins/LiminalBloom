import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSession } from "@/lib/layout/session-core";
import { face, fixture, store } from "@/lib/layout/test-layouts";
import type { Fixture } from "@/lib/layout/types";

import { PropertiesPanel } from "./properties-panel";

function panel(over: Partial<Fixture> = {}) {
  const dispatch = vi.fn();
  const bay = fixture({ id: "bay", type: "wall_bay", name: "Back wall", width: 120, depth: 24, ...over });
  const layout = { ...store(), fixtures: [bay], faces: [face({ fixtureId: "bay", side: "front" })] };
  render(<PropertiesPanel session={{ ...createSession(layout, false), selection: ["bay"] }} dispatch={dispatch} />);
  return dispatch;
}

const curveTo = (curve: number) => ({ type: "command", command: { type: "updateFixture", id: "bay", changes: { curve } } });

/** A straight bay's Curve is folded behind its line (DECISIONS 11-11). */
const openCurve = () => userEvent.click(screen.getByRole("button", { name: /^Curve/ }));

describe("the Curve field", () => {
  // What was opened is remembered on the device.
  beforeEach(() => window.localStorage.clear());

  it("is folded behind a line saying Straight on a straight bay", () => {
    panel();
    expect(screen.getByRole("button", { name: "Curve Straight" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: "Curve, inches" })).toBeNull();
  });

  it("opens itself on a curved bay, says how far and which way, and folds by hand", async () => {
    panel({ curve: -18 });
    const line = screen.getByRole("button", { name: "Curve 1′ 6″ toward the back" });
    expect(line).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(line);
    expect(screen.queryByRole("textbox", { name: "Curve, inches" })).toBeNull();
  });

  it("sets a straight bay's curve toward the front", async () => {
    const dispatch = panel();
    await openCurve();
    const inches = screen.getByRole("textbox", { name: "Curve, inches" });
    await userEvent.clear(inches);
    await userEvent.type(inches, "18{Enter}");
    expect(dispatch).toHaveBeenCalledWith(curveTo(18));
  });

  it("says the width runs along the curve, once there is one", () => {
    panel({ curve: 18 });
    expect(screen.getByText("Width is measured along the curve's centre.")).toBeInTheDocument();
  });

  it("offers no direction while the bay is straight", async () => {
    panel();
    await openCurve();
    expect(screen.queryByRole("button", { name: "Flip curve" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Width along the curve" })).toBeNull();
  });

  it("says which way it bends and flips it", async () => {
    const dispatch = panel({ curve: 18 });
    expect(screen.getByText("Bends toward the front")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Flip curve" }));
    expect(dispatch).toHaveBeenCalledWith(curveTo(-18));
  });

  it("keeps the direction when the depth of the curve changes", async () => {
    const dispatch = panel({ curve: -18 });
    expect(screen.getByText("Bends toward the back")).toBeInTheDocument();
    const inches = screen.getByRole("textbox", { name: "Curve, inches" });
    await userEvent.clear(inches);
    await userEvent.type(inches, "9{Enter}");
    expect(dispatch).toHaveBeenCalledWith(curveTo(-21));
  });

  it("names the width for what it measures", () => {
    panel({ curve: 18 });
    expect(screen.getByRole("group", { name: "Width along the curve" })).toBeInTheDocument();
  });

  it("refuses more than the bay can take", async () => {
    const dispatch = panel();
    await openCurve();
    const feet = screen.getByRole("textbox", { name: "Curve, feet" });
    await userEvent.clear(feet);
    await userEvent.type(feet, "9{Enter}");
    expect(screen.getByText(/^Between 0″ and/)).toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("isn't offered on other fixtures", () => {
    const layout = { ...store(), fixtures: [fixture({ id: "t" })], faces: [face({ fixtureId: "t" })] };
    render(<PropertiesPanel session={{ ...createSession(layout, false), selection: ["t"] }} dispatch={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Curve" })).toBeNull();
  });
});
