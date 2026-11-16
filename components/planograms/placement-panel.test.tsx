import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlacementView, PlanogramFace } from "@/lib/planograms/types";

import { PlacementEditor } from "./placement-panel";
import type { CommitResult } from "./use-builder";

vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

const top: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "t", fixtureName: "Table 1", fixtureType: "table", side: "top", setSide: null, label: "Top", columns: 6, rows: 3 };
const front: PlanogramFace = { ...top, faceId: "00000000-0000-4000-8000-000000000002", fixtureType: "rack", side: "front", label: "Front", rows: 4 };
const placement: PlacementView = {
  depth: 0,
  id: "p", productId: "pr", productName: "Pocket Tee", styleNumber: "PT-1", version: 1, imageKey: null, categoryName: "Denim",
  faceId: top.faceId, presentation: "hung", col: 0, row: 0, colSpan: 1, rowSpan: 3, pieceCount: 20,
};
const saved: CommitResult = { ok: true, id: "p" };

type Props = Partial<React.ComponentProps<typeof PlacementEditor>>;
function renderPanel(over: Props = {}) {
  const props = { placement, isGone: false, faces: [top], others: [], busy: false, onClose: vi.fn(), onSave: vi.fn().mockResolvedValue(saved), onRemove: vi.fn(), onMoveToFace: vi.fn().mockResolvedValue(null), ...over };
  return { props, ...render(<PlacementEditor {...props} />) };
}

describe("PlacementEditor", () => {
  afterEach(() => vi.useRealTimers());

  it("says so when the other device removed the open placement", () => {
    renderPanel({ placement: null, isGone: true, faces: [] });
    expect(screen.getByText("Removed on another device")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pieces")).toBeNull();
  });

  it("a placement whose face left the set can only be removed, with a trash icon", async () => {
    const { props } = renderPanel({ placement: { ...placement, faceId: "00000000-0000-4000-8000-0000000000ff" } });
    expect(screen.getByText("No longer in this set")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pieces")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Remove Pocket Tee" }));
    expect(props.onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "p" }));
  });

  // No stack limit since Week 6.5 (spec §3.3): a folded switch keeps the piece count. It saves on change, with no Save button.
  it("switches hung → folded without a stack limit in the way, saving at once", async () => {
    const { props } = renderPanel();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "Folded" }));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "p" }), expect.objectContaining({ presentation: "folded", pieceCount: 20 }));
  });

  it("shows the server's refusal in the panel, not only behind it", async () => {
    vi.useFakeTimers();
    renderPanel({ onSave: vi.fn().mockResolvedValue({ ok: false, message: "Changed on another device" }) });
    fireEvent.change(screen.getByLabelText("Pieces"), { target: { value: "5" } });
    await act(async () => vi.advanceTimersByTime(600));
    expect(screen.getByRole("alert")).toHaveTextContent("Changed on another device");
  });

  it("sends what was typed when the panel closes, into the placement it was typed for", () => {
    vi.useFakeTimers();
    const { props, unmount } = renderPanel();
    fireEvent.change(screen.getByLabelText("Pieces"), { target: { value: "5" } });
    unmount();
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "p" }), expect.objectContaining({ pieceCount: 5 }));
  });

  it("sends what was typed when another tile is picked, into the first tile, not the new one", () => {
    vi.useFakeTimers();
    const other: PlacementView = { ...placement, id: "q", productName: "Crew Sock", pieceCount: 3 };
    const { props, rerender } = renderPanel();
    fireEvent.change(screen.getByLabelText("Pieces"), { target: { value: "5" } });
    rerender(<PlacementEditor {...props} placement={other} />);
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "p" }), expect.objectContaining({ pieceCount: 5 }));
    // The new tile's form starts from its own numbers, and nothing more is sent for it.
    expect(screen.getByLabelText("Pieces")).toHaveValue("3");
    act(() => vi.advanceTimersByTime(5000));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  describe("face picker", () => {
    it("is hidden when the planogram has one face", () => {
      renderPanel();
      expect(screen.queryByRole("group", { name: "Face" })).toBeNull();
    });

    it("shows every face, marks the current one, and moves the tile to the one picked", async () => {
      const { props } = renderPanel({ faces: [top, front] });
      const group = screen.getByRole("group", { name: "Face" });
      expect(screen.getByRole("button", { name: "Top" })).toHaveAttribute("aria-pressed", "true");
      expect(group).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Front" }));
      expect(props.onMoveToFace).toHaveBeenCalledWith(expect.objectContaining({ id: "p" }), front.faceId);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("picking the face it is already on moves nothing", async () => {
      const { props } = renderPanel({ faces: [top, front] });
      await userEvent.click(screen.getByRole("button", { name: "Top" }));
      expect(props.onMoveToFace).not.toHaveBeenCalled();
    });

    it("shows a refusal inline in the panel, and clears it on the next pick", async () => {
      const onMoveToFace = vi.fn().mockResolvedValueOnce("No open spot fits on Front").mockResolvedValue(null);
      renderPanel({ faces: [top, front], onMoveToFace });
      await userEvent.click(screen.getByRole("button", { name: "Front" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("No open spot fits on Front");
      await userEvent.click(screen.getByRole("button", { name: "Front" }));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
