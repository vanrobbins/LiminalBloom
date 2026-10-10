import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanogramFace } from "@/lib/planograms/types";

import { PlacementForm } from "./placement-form";

const front: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack", side: "front", setSide: null, label: "Front", columns: 6, rows: 4 };
const pant = { id: "p", faceId: front.faceId, productName: "High-Rise Pant", col: 0, row: 0, colSpan: 2, rowSpan: 2 };
const initial = { faceId: front.faceId, presentation: "folded" as const, col: 2, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 1 };

function renderForm(onSubmit = vi.fn().mockResolvedValue(null)) {
  render(<PlacementForm faces={[front]} initial={initial} others={[pant]} excludeId={null} stackLimitFor={() => 8} submitLabel="Add" busy={false} onSubmit={onSubmit} />);
  return onSubmit;
}

describe("PlacementForm", () => {
  it("submits typed cells as fields", async () => {
    const onSubmit = renderForm();
    await userEvent.clear(screen.getByLabelText("Cell"));
    await userEvent.type(screen.getByLabelText("Cell"), "c3");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledWith({ ...initial, col: 2, row: 2 });
  });

  it("names the rule a placement breaks, and doesn't submit", async () => {
    const onSubmit = renderForm();
    await userEvent.clear(screen.getByLabelText("Cell"));
    await userEvent.type(screen.getByLabelText("Cell"), "B1");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Blocked by High-Rise Pant")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Cell"));
    await userEvent.type(screen.getByLabelText("Cell"), "C1");
    await userEvent.clear(screen.getByLabelText("Pieces"));
    await userEvent.type(screen.getByLabelText("Pieces"), "9");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("More than this product's stack limit (8)")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Cell"));
    await userEvent.type(screen.getByLabelText("Cell"), "zz");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Type a cell like A4.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the server's refusal beside the fields", async () => {
    renderForm(vi.fn().mockResolvedValue("Blocked by Crew Sock"));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Blocked by Crew Sock");
  });
});
