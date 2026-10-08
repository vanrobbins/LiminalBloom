import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FootprintFields } from "./footprint-fields";

const category = { hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 8 };

describe("FootprintFields", () => {
  it("shows the category's defaults and adds an override from them", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FootprintFields category={category} overrides={{}} onChange={onChange} />);
    expect(screen.getByText("Hung: 1 × 3, stack 8 (category default)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Override hung for this product" }));
    expect(onChange).toHaveBeenCalledWith({ hung: { columns: 1, rows: 3, stackLimit: 8 } });
  });

  it("shows an override with steppers and a way back to the default", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FootprintFields category={category} overrides={{ folded: { columns: 3, rows: 2, stackLimit: 4 } }} onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Folded columns" })).toHaveTextContent("3");
    await user.click(screen.getByRole("button", { name: "Use category default for folded" }));
    expect(onChange).toHaveBeenCalledWith({});
  });
});
