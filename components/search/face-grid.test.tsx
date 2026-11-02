import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FaceGrid } from "./face-grid";

const LABEL = "Front table 1 · Left · Middle, 0–2 ft from left · 0–2 ft from back";
const grid = { columns: 12, rows: 3 };
const cells = { col: 0, row: 0, colSpan: 4, rowSpan: 2 };

describe("FaceGrid", () => {
  it("describes the place for screen readers with the label it is given", () => {
    render(<FaceGrid grid={grid} cells={cells} label={LABEL} />);
    expect(screen.getByRole("img", { name: LABEL })).toBeInTheDocument();
  });

  it("draws one filled cell per covered cell", () => {
    const { container } = render(<FaceGrid grid={grid} cells={cells} label="T" />);
    expect(container.querySelectorAll("[data-filled]")).toHaveLength(8);
  });

  it("draws no cell names", () => {
    const { container } = render(<FaceGrid grid={grid} cells={cells} label="T" />);
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });
});
