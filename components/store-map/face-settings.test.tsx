import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { face, fixture } from "@/lib/layout/test-layouts";

import { FaceSettings } from "./face-settings";

const rack = fixture({ type: "rack", width: 96, depth: 24 });

describe("FaceSettings", () => {
  it("offers Fit to fixture for a hand-set grid, and fits it", async () => {
    const dispatch = vi.fn();
    render(<FaceSettings fixture={rack} faces={[face({ side: "front", columns: 4, rows: 3 })]} dispatch={dispatch} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Fit to fixture (8 × 3)" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "command", command: { type: "setFaceGrid", faceId: "face-a", columns: 8, rows: 3 } });
  });

  it("hides it when the grid already fits", () => {
    render(<FaceSettings fixture={rack} faces={[face({ side: "front", columns: 8, rows: 3 })]} dispatch={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Fit to fixture/ })).not.toBeInTheDocument();
  });
});
