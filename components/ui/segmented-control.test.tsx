import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "./segmented-control";

describe("SegmentedControl", () => {
  it("presses the current option and reports a change", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Show" options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} value="draft" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Show" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.setup().click(screen.getByRole("button", { name: "Published" }));
    expect(onChange).toHaveBeenCalledWith("published");
  });
});
