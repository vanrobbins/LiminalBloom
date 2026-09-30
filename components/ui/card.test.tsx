import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card } from "./card";

describe("Card", () => {
  it("renders its children on a raised surface", () => {
    render(<Card>Pioneer Place</Card>);
    const card = screen.getByText("Pioneer Place");
    expect(card.className).toContain("bg-raised");
  });

  it("uses tighter padding when compact, for rows in a list", () => {
    render(<Card compact>Pioneer Place</Card>);
    const { className } = screen.getByText("Pioneer Place");
    expect(className).toContain("p-4");
    expect(className).not.toContain("p-6");
  });

  it("has no shadow, since cards do not float (§5.5)", () => {
    render(<Card>Pioneer Place</Card>);
    expect(screen.getByText("Pioneer Place").className).not.toMatch(/shadow/);
  });
});
