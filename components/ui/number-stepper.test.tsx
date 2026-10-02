import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NumberStepper } from "./number-stepper";

describe("NumberStepper", () => {
  it("steps up and down, and stops at its limits", async () => {
    const onChange = vi.fn();
    render(<NumberStepper label="Columns" value={24} min={1} max={24} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "More columns" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Fewer columns" }));
    expect(onChange).toHaveBeenCalledWith(23);
  });

  it("is a labelled group showing its value", () => {
    render(<NumberStepper label="Rows" value={3} min={1} max={24} onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Rows" })).toHaveTextContent("3");
  });
});
