import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanogramFace } from "@/lib/planograms/types";

import { PlacementForm } from "./placement-form";

// A 6 ft rack face (12 half-foot columns) with 4 levels.
const front: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 12, rows: 4 };
const top: PlanogramFace = { ...front, faceId: "00000000-0000-4000-8000-000000000002", fixtureType: "table", side: "top", label: "Top", rows: 3 };
const pant = { id: "p", faceId: front.faceId, productName: "High-Rise Pant", col: 0, row: 0, colSpan: 4, rowSpan: 2 };
const initial = { faceId: front.faceId, presentation: "folded" as const, col: 4, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 1 };

function renderForm({ onSubmit = vi.fn().mockResolvedValue(null), faces = [front] } = {}) {
  render(<PlacementForm faces={faces} initial={initial} others={[pant]} excludeId={null} submitLabel="Add" busy={false} onSubmit={onSubmit} />);
  return onSubmit;
}

async function type(label: string, text: string) {
  await userEvent.clear(screen.getByLabelText(label));
  await userEvent.type(screen.getByLabelText(label), text);
}

describe("PlacementForm", () => {
  it("starts from the placement in feet and levels", () => {
    renderForm();
    expect(screen.getByLabelText("From left (ft)")).toHaveValue("2");
    expect(screen.getByLabelText("Width (ft)")).toHaveValue("2");
    expect(screen.getByLabelText("Top level")).toHaveValue("1");
    expect(screen.getByLabelText("Levels tall")).toHaveValue("2");
  });

  it("submits feet in half steps and levels as fields", async () => {
    const onSubmit = renderForm();
    await type("From left (ft)", "3½");
    await type("Width (ft)", "1.5");
    await type("Top level", "3");
    await type("Levels tall", "1");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledWith({ ...initial, col: 7, colSpan: 3, row: 2, rowSpan: 1 });
  });

  it("counts a back lower table's numbers from its outer edge and saves them as stored", async () => {
    const back: PlanogramFace = { ...top, setSide: "back", label: "Back table", rows: 2 };
    const onSubmit = vi.fn().mockResolvedValue(null);
    const stored = { ...initial, faceId: back.faceId, col: 0, row: 0, colSpan: 4, rowSpan: 1 };
    render(<PlacementForm faces={[back]} initial={stored} others={[]} excludeId={null} submitLabel="Add" busy={false} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("From left (ft)")).toHaveValue("4");
    expect(screen.getByLabelText("From back (ft)")).toHaveValue("1");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledWith(stored);
  });

  it("asks a table top for feet from the back and depth", async () => {
    const onSubmit = renderForm({ faces: [top, front] });
    await userEvent.selectOptions(screen.getByLabelText("Side"), "Top");
    await type("From back (ft)", "1");
    await type("Depth (ft)", "2");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledWith({ ...initial, faceId: top.faceId, row: 1, rowSpan: 2 });
  });

  it("names From back when a table top's whole-foot fields are bad", async () => {
    const onSubmit = renderForm({ faces: [top, front] });
    await userEvent.selectOptions(screen.getByLabelText("Side"), "Top");
    await type("From back (ft)", "1.5");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Use whole feet for from back and depth, and whole numbers for pieces.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("names the rule a placement breaks, and doesn't submit", async () => {
    const onSubmit = renderForm();
    await type("From left (ft)", "1");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Blocked by High-Rise Pant")).toBeInTheDocument();
    await type("From left (ft)", "2");
    await type("Pieces", "100");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("At most 99 pieces")).toBeInTheDocument();
    await type("From left (ft)", "2.25");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Use feet in half steps, like 4 or 4½.")).toBeInTheDocument();
    await type("From left (ft)", "2");
    await type("Top level", "0");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Use whole numbers from 1 for levels and pieces.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses a zero width and a placement past the end of the face", async () => {
    const onSubmit = renderForm();
    await type("Width (ft)", "0");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Width must be at least ½ ft.")).toBeInTheDocument();
    await type("Width (ft)", "2");
    await type("From left (ft)", "5");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Off the edge of the face")).toBeInTheDocument();
    await type("From left (ft)", "99");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Off the edge of the face")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the server's refusal beside the fields", async () => {
    renderForm({ onSubmit: vi.fn().mockResolvedValue("Blocked by Crew Sock") });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Blocked by Crew Sock");
  });
});
