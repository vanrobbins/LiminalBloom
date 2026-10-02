import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NumberField } from "./number-field";

describe("NumberField", () => {
  it("commits a whole number in range on Enter", async () => {
    const onCommit = vi.fn();
    render(<NumberField label="Rotation" value={0} min={0} max={359} suffix="°" onCommit={onCommit} />);
    const field = screen.getByRole("textbox", { name: "Rotation" });
    await userEvent.clear(field);
    await userEvent.type(field, "45{Enter}");
    expect(onCommit).toHaveBeenCalledWith(45);
  });

  it("refuses anything else", async () => {
    const onCommit = vi.fn();
    render(<NumberField label="Rotation" value={0} min={0} max={359} onCommit={onCommit} />);
    const field = screen.getByRole("textbox", { name: "Rotation" });
    await userEvent.clear(field);
    await userEvent.type(field, "400{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("Use a whole number from 0 to 359.")).toBeInTheDocument();
  });
});
