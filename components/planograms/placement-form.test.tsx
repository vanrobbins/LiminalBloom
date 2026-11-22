import { act, fireEvent, render, screen } from "@testing-library/react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlacementFields, PlanogramFace } from "@/lib/planograms/types";

import type { CommitResult } from "./use-builder";
import { PlacementForm } from "./placement-form";

// A 6 ft rack face (12 half-foot columns) with 4 levels.
const front: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 12, rows: 4 };
const top: PlanogramFace = { ...front, faceId: "00000000-0000-4000-8000-000000000002", fixtureType: "table", side: "top", label: "Top", rows: 3 };
const pant = { id: "p", faceId: front.faceId, productName: "High-Rise Pant", col: 0, row: 0, colSpan: 4, rowSpan: 2 };
const initial = { faceId: front.faceId, presentation: "folded" as const, col: 4, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 1 };
const saved: CommitResult = { ok: true, id: "p" };

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

function renderForm({ onSubmit = vi.fn().mockResolvedValue(saved), faces = [front], start = initial }: { onSubmit?: (fields: PlacementFields) => Promise<CommitResult>; faces?: PlanogramFace[]; start?: PlacementFields } = {}) {
  const view = render(<PlacementForm faces={faces} initial={start} others={[pant]} excludeId={null} onSubmit={onSubmit} />);
  return { onSubmit, ...view };
}

// fireEvent, not userEvent: user-event waits on a real timer, which fake timers never fire.
function type(label: string, text: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
}
const blur = (label: string) => fireEvent.blur(screen.getByLabelText(label));

/** Types, then lets the pause pass so the edit is checked and sent. */
async function typeAndPause(label: string, text: string) {
  type(label, text);
  await wait(600);
}

describe("PlacementForm", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts from the placement in feet and levels, with no Save button and no face select", () => {
    renderForm();
    expect(screen.getByLabelText("From left (ft)")).toHaveValue("2");
    expect(screen.getByLabelText("Width (ft)")).toHaveValue("2");
    expect(screen.getByLabelText("Top level")).toHaveValue("1");
    expect(screen.getByLabelText("Levels tall")).toHaveValue("2");
    expect(screen.queryByRole("button", { name: /save|remove/i })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("sends nothing while typing, then one save of feet in half steps and levels 600 ms after the last key", async () => {
    const { onSubmit } = renderForm();
    type("From left (ft)", "3½");
    type("Width (ft)", "1.5");
    type("Top level", "3");
    type("Levels tall", "1");
    await wait(599);
    expect(onSubmit).not.toHaveBeenCalled();
    await wait(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ ...initial, col: 7, colSpan: 3, row: 2, rowSpan: 1 });
    await wait(5000);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("saves on blur at once, and the pause that was running sends nothing more", async () => {
    const { onSubmit } = renderForm();
    type("Pieces", "5");
    blur("Pieces");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ ...initial, pieceCount: 5 });
    await wait(5000);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("saves a presentation choice on change, with whatever else is waiting", async () => {
    const { onSubmit } = renderForm();
    type("Pieces", "6");
    fireEvent.click(screen.getByRole("radio", { name: "Hung" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ ...initial, presentation: "hung", pieceCount: 6 });
    await wait(5000);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("a blur or a pause with nothing changed sends nothing", async () => {
    const { onSubmit } = renderForm();
    fireEvent.focus(screen.getByLabelText("Pieces"));
    blur("Pieces");
    // Different text, the same numbers: still nothing to save.
    type("Pieces", "01");
    await wait(600);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("counts a back lower table's numbers from its outer edge and saves them as stored", async () => {
    const back: PlanogramFace = { ...top, setSide: "back", label: "Back table", rows: 2 };
    const stored = { ...initial, faceId: back.faceId, col: 0, row: 0, colSpan: 4, rowSpan: 1 };
    const { onSubmit } = renderForm({ faces: [back], start: stored });
    expect(screen.getByLabelText("From left (ft)")).toHaveValue("4");
    expect(screen.getByLabelText("From back (ft)")).toHaveValue("1");
    await typeAndPause("Pieces", "5");
    expect(onSubmit).toHaveBeenCalledWith({ ...stored, pieceCount: 5 });
  });

  it("asks a table top for feet from the back and depth", async () => {
    const onTop = { ...initial, faceId: top.faceId };
    const { onSubmit } = renderForm({ faces: [top, front], start: onTop });
    type("From back (ft)", "1");
    type("Depth (ft)", "2");
    await wait(600);
    expect(onSubmit).toHaveBeenCalledWith({ ...onTop, row: 1, rowSpan: 2 });
  });

  it("names From back when a table top's whole-foot fields are bad", async () => {
    const { onSubmit } = renderForm({ faces: [top, front], start: { ...initial, faceId: top.faceId } });
    await typeAndPause("From back (ft)", "1.5");
    expect(screen.getByText("Use whole feet for from back and depth, and whole numbers for pieces.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("names the rule a placement breaks, keeps the value in the field, and sends nothing", async () => {
    const { onSubmit } = renderForm();
    await typeAndPause("From left (ft)", "1");
    expect(screen.getByRole("alert")).toHaveTextContent("Blocked by High-Rise Pant");
    expect(screen.getByLabelText("From left (ft)")).toHaveValue("1");
    await typeAndPause("From left (ft)", "2");
    await typeAndPause("Pieces", "100");
    expect(screen.getByText("At most 99 pieces")).toBeInTheDocument();
    await typeAndPause("Pieces", "1");
    await typeAndPause("From left (ft)", "2.25");
    expect(screen.getByText("Use feet in half steps, like 4 or 4½.")).toBeInTheDocument();
    await typeAndPause("From left (ft)", "2");
    await typeAndPause("Top level", "0");
    expect(screen.getByText("Use whole numbers from 1 for levels and pieces.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
