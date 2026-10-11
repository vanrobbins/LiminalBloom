import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card } from "./card";

describe("Card", () => {
  it("has no shadow, since cards do not float (§5.5)", () => {
    render(<Card>Pioneer Place</Card>);
    expect(screen.getByText("Pioneer Place").className).not.toMatch(/shadow/);
  });
});
