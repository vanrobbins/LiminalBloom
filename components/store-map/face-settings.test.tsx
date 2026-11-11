import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { face, fixture } from "@/lib/layout/test-layouts";

import { FaceSettings } from "./face-settings";

const rack = fixture({ type: "rack", width: 96, depth: 24 });

describe("FaceSettings", () => {
  // What was opened is remembered on the device.
  beforeEach(() => window.localStorage.clear());

  it("offers Fit to fixture for a hand-set grid, and fits it", async () => {
    const dispatch = vi.fn();
    render(<FaceSettings fixture={rack} faces={[face({ side: "front", columns: 10, rows: 3 })]} dispatch={dispatch} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Fit to fixture (8 ft × 3)" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "command", command: { type: "setFaceGrid", faceId: "face-a", columns: 16, rows: 3 } });
  });

  it("hides it when the grid already fits", async () => {
    render(<FaceSettings fixture={rack} faces={[face({ side: "front", columns: 16, rows: 3 })]} dispatch={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /^Planogram grid/ }));
    expect(screen.getByRole("button", { name: "More width" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fit to fixture/ })).not.toBeInTheDocument();
  });

  it("folds a grid that follows its fixture behind one line saying its size, and opens a hand-set one (DECISIONS 11-11)", () => {
    const { unmount } = render(<FaceSettings fixture={rack} faces={[face({ side: "front", columns: 16, rows: 3 })]} dispatch={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Planogram grid 8 ft × 3 rows" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "More width" })).toBeNull();
    unmount();
    render(<FaceSettings fixture={rack} faces={[face({ side: "front", columns: 10, rows: 3 })]} dispatch={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^Planogram grid/ })).toHaveAttribute("aria-expanded", "true");
  });
});
