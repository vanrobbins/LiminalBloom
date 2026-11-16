// The editor's own-save echo and its re-fill (0.7.0.5 task 6 review): what a placement coming back as a prop is
// (the echo of a save, another device's change, an Undo, or the server keeping something else), and what typing
// that was waiting does when the numbers are replaced under it.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlacementFields, PlanogramFace } from "@/lib/planograms/types";

import { PlacementForm } from "./placement-form";
import type { CommitResult } from "./use-builder";

const front: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 12, rows: 4 };
const rail: PlanogramFace = { ...front, faceId: "00000000-0000-4000-8000-000000000003", fixtureType: "frame_rack", rows: 1 };
const initial: PlacementFields = { faceId: front.faceId, presentation: "folded", col: 4, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 1 };
const saved: CommitResult = { ok: true, id: "p" };

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const type = (label: string, text: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
const field = (label: string) => screen.getByLabelText(label);
const form = (placement: PlacementFields, onSubmit = vi.fn().mockResolvedValue(saved), faces = [front]) => (
  <PlacementForm faces={faces} initial={placement} others={[]} excludeId={null} onSubmit={onSubmit} />
);
const typeAndPause = async (label: string, text: string) => {
  type(label, text);
  await wait(600);
};

describe("the editor's re-fill", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("drops what was waiting when another device's change re-fills the fields: neither the pause nor a blur sends it over their change", async () => {
    const onSubmit = vi.fn().mockResolvedValue(saved);
    const { rerender } = render(form(initial, onSubmit));
    type("Pieces", "5");
    rerender(form({ ...initial, col: 8 }, onSubmit));
    expect(field("From left (ft)")).toHaveValue("4");
    expect(field("Pieces")).toHaveValue("1");
    fireEvent.blur(field("Pieces"));
    await wait(5000);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("an Undo landing while a text edit waits does the same", async () => {
    const onSubmit = vi.fn().mockResolvedValue(saved);
    const { rerender } = render(form(initial, onSubmit));
    await typeAndPause("Pieces", "5");
    rerender(form({ ...initial, pieceCount: 5 }, onSubmit));
    type("Width (ft)", "1.5");
    // Undo: the first numbers come back while the width is still waiting.
    rerender(form(initial, onSubmit));
    expect(field("Width (ft)")).toHaveValue("2");
    await wait(5000);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("with more than one save sent, an echo of an older one is not a change, and an Undo past all of them is", async () => {
    const onSubmit = vi.fn().mockResolvedValue(saved);
    const { rerender } = render(form(initial, onSubmit));
    await typeAndPause("Pieces", "5");
    await typeAndPause("Pieces", "6");
    expect(onSubmit).toHaveBeenCalledTimes(2);
    // The first save's reply arrives after the second was sent: it is ours, so the fields keep what was typed.
    rerender(form({ ...initial, pieceCount: 5 }, onSubmit));
    expect(field("Pieces")).toHaveValue("6");
    // The last save has come back: from here an older state is a change to show.
    rerender(form({ ...initial, pieceCount: 6 }, onSubmit));
    expect(field("Pieces")).toHaveValue("6");
    rerender(form({ ...initial, pieceCount: 5 }, onSubmit));
    expect(field("Pieces")).toHaveValue("5");
    rerender(form(initial, onSubmit));
    expect(field("Pieces")).toHaveValue("1");
  });

  it("shows what the server kept when it is not what was sent", async () => {
    const onSubmit = vi.fn().mockResolvedValue(saved);
    const { rerender } = render(form(initial, onSubmit));
    await typeAndPause("Pieces", "5");
    rerender(form({ ...initial, pieceCount: 9 }, onSubmit));
    expect(field("Pieces")).toHaveValue("9");
    // And it is now what the form holds: typing 9 back is no change, typing 5 is a save again.
    await typeAndPause("Pieces", "9");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await typeAndPause("Pieces", "5");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("on a frame rack, a folded placement is sent hung on its one row, and that coming back is not a change", async () => {
    const onSubmit = vi.fn().mockResolvedValue(saved);
    const onRail = { ...initial, faceId: rail.faceId, col: 0, colSpan: 2, rowSpan: 1 };
    const { rerender } = render(form(onRail, onSubmit, [rail]));
    await typeAndPause("Pieces", "5");
    expect(onSubmit).toHaveBeenCalledWith({ ...onRail, presentation: "hung", row: 0, rowSpan: 1, pieceCount: 5 });
    type("Pieces", "6");
    rerender(form({ ...onRail, presentation: "hung", pieceCount: 5 }, onSubmit, [rail]));
    expect(field("Pieces")).toHaveValue("6");
  });
});

describe("the form's one gesture, one save", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a presentation radio chosen while a text edit waits sends both in one save, not the text and then the radio", async () => {
    const onSubmit = vi.fn().mockResolvedValue(saved);
    render(form(initial, onSubmit));
    act(() => field("Pieces").focus());
    type("Pieces", "6");
    // A press on the radio: focus moves to it (blurring the text), then it is chosen.
    const hung = screen.getByRole("radio", { name: "Hung" });
    act(() => hung.focus());
    fireEvent.click(hung);
    await wait(5000);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ ...initial, presentation: "hung", pieceCount: 6 });
  });

  it("leaving the text for another text field still sends it at once", async () => {
    const onSubmit = vi.fn().mockResolvedValue(saved);
    render(form(initial, onSubmit));
    act(() => field("Pieces").focus());
    type("Pieces", "6");
    act(() => field("Width (ft)").focus());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("a refused value is tied to the field it is about", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("marks the offending input invalid and described by the alert, and no other", async () => {
    render(form(initial));
    await typeAndPause("Pieces", "100");
    const alert = screen.getByRole("alert");
    expect(field("Pieces")).toHaveAttribute("aria-invalid", "true");
    expect(field("Pieces").getAttribute("aria-describedby")).toContain(alert.id);
    expect(field("Width (ft)")).not.toHaveAttribute("aria-invalid");
    expect(field("Width (ft)").getAttribute("aria-describedby") ?? "").not.toContain(alert.id);
  });

  it("keeps the hint in the description too, and clears the marks once the value is fixed", async () => {
    render(form(initial));
    await typeAndPause("From left (ft)", "2.25");
    const alert = screen.getByRole("alert");
    expect(field("From left (ft)")).toHaveAttribute("aria-invalid", "true");
    expect(field("From left (ft)").getAttribute("aria-describedby")).toContain(alert.id);
    expect(screen.getByText("Half steps: 4 or 4½.").id).not.toBe("");
    expect(field("From left (ft)").getAttribute("aria-describedby")).toContain(screen.getByText("Half steps: 4 or 4½.").id);
    await typeAndPause("From left (ft)", "2");
    expect(field("From left (ft)")).not.toHaveAttribute("aria-invalid");
  });

  it("a rule broken by the position marks the position fields; a server refusal marks every number", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, message: "Changed on another device" });
    render(form(initial, onSubmit));
    await typeAndPause("Width (ft)", "20");
    expect(screen.getByRole("alert")).toHaveTextContent("Off the edge of the face");
    expect(field("Width (ft)")).toHaveAttribute("aria-invalid", "true");
    expect(field("Pieces")).not.toHaveAttribute("aria-invalid");
    await typeAndPause("Width (ft)", "2");
    await typeAndPause("Pieces", "5");
    expect(screen.getByRole("alert")).toHaveTextContent("Changed on another device");
    expect(field("Pieces")).toHaveAttribute("aria-invalid", "true");
  });
});
