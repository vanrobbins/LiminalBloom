import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanogramFace } from "@/lib/planograms/types";

import { FaceSwitcher } from "./face-switcher";

const face = (faceId: string, label: string): PlanogramFace => ({ faceId, fixtureId: "r", fixtureName: "Rack", side: "front", setSide: null, label, columns: 6, rows: 4 });

describe("FaceSwitcher", () => {
  it("offers each enabled face and marks the one shown", async () => {
    const onChange = vi.fn();
    render(<FaceSwitcher faces={[face("f", "Front"), face("b", "Back")]} value="f" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Side" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Front" })).toHaveAttribute("aria-pressed", "true");
    // Not colour alone: the shown face also carries a check.
    expect(screen.getByRole("button", { name: "Front" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Back" }).querySelector("svg")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("is hidden when there is only one face", () => {
    const { container } = render(<FaceSwitcher faces={[face("f", "Front")]} value="f" onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
