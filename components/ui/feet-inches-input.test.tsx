import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FeetInchesInput } from "./feet-inches-input";

function setup(value = 76) {
  const onCommit = vi.fn();
  render(<FeetInchesInput label="Width" value={value} min={12} max={600} onCommit={onCommit} />);
  return {
    onCommit,
    feet: screen.getByRole("textbox", { name: "Width, feet" }),
    inches: screen.getByRole("textbox", { name: "Width, inches" }),
  };
}

describe("FeetInchesInput", () => {
  it("shows inches as feet and inches", () => {
    const { feet, inches } = setup(76);
    expect(feet).toHaveValue("6");
    expect(inches).toHaveValue("4");
  });

  it("commits whole inches on blur", async () => {
    const { feet, onCommit } = setup(76);
    await userEvent.clear(feet);
    await userEvent.type(feet, "8");
    await userEvent.tab();
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith(100);
  });

  it("never commits junk (Review Focus 2)", async () => {
    const { feet, inches, onCommit } = setup(76);
    for (const junk of ["abc", "-3", "4.5"]) {
      await userEvent.clear(feet);
      await userEvent.type(feet, junk);
      await userEvent.tab();
    }
    await userEvent.clear(feet);
    await userEvent.clear(inches);
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/between 1′ and 50′/i)).toBeInTheDocument();
  });

  it("commits once, when focus leaves both fields", async () => {
    const { feet, inches, onCommit } = setup(76);
    await userEvent.clear(feet);
    await userEvent.type(feet, "8");
    await userEvent.tab();
    expect(inches).toHaveFocus();
    expect(onCommit).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(100);
  });

  it("explains a value that is not a whole number", async () => {
    const { feet } = setup(76);
    await userEvent.clear(feet);
    await userEvent.type(feet, "abc");
    await userEvent.tab();
    expect(screen.getByText("Use whole numbers.")).toBeInTheDocument();
    expect(feet).toHaveAttribute("aria-invalid", "true");
  });
});
