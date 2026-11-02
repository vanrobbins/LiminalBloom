import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SelectionBar } from "./selection-bar";

const handlers = () => ({ onDetails: vi.fn(), onEdit: vi.fn(), onMoveFace: vi.fn(), onRemove: vi.fn() });

describe("SelectionBar", () => {
  it("names the selected product and offers its four actions", async () => {
    const on = handlers();
    render(<SelectionBar name="High-Rise Pant" canMoveFace busy={false} {...on} />);
    expect(screen.getByRole("toolbar", { name: "High-Rise Pant selected" })).toBeInTheDocument();
    const pairs = [["Details", on.onDetails], ["Edit numbers", on.onEdit], ["Move to face…", on.onMoveFace], ["Remove", on.onRemove]] as const;
    for (const [name, fn] of pairs) {
      await userEvent.click(screen.getByRole("button", { name }));
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("leaves out Move to face when there is only one face", () => {
    render(<SelectionBar name="Pant" canMoveFace={false} busy={false} {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Move to face…" })).toBeNull();
  });
});
