import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FaceGrid } from "./face-grid";

describe("FaceGrid", () => {
  it("names the filled cells and the grid size for screen readers", () => {
    render(<FaceGrid grid={{ columns: 6, rows: 3 }} cells={{ col: 0, row: 0, colSpan: 2, rowSpan: 2 }} label="Front table 1" />);
    expect(screen.getByRole("img", { name: "Front table 1: cells A1–B2 of a 6 by 3 grid" })).toBeInTheDocument();
  });

  it("draws one filled cell per covered cell", () => {
    const { container } = render(<FaceGrid grid={{ columns: 6, rows: 3 }} cells={{ col: 1, row: 1, colSpan: 2, rowSpan: 1 }} label="T" />);
    expect(container.querySelectorAll("[data-filled]")).toHaveLength(2);
  });
});
