// The adjust page's state (0.7.0.9 spec §4.1, §5.1): a choice opens the draft if there is none, saves at once under the
// tile's own change version, and goes on a per-tile Undo/Redo stack that a conflict or a gone draft clears.

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdjustmentState, ChangeRow } from "@/lib/planograms/adjust";
import { entry } from "@/lib/planograms/test-adjust";

const actions = vi.hoisted(() => ({ openAdjustmentAction: vi.fn(), setChangeAction: vi.fn() }));
vi.mock("@/app/(app)/planograms/adjust-actions", () => actions);
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

import { useAdjustment } from "./use-adjustment";

const tile = entry({ productId: "a", productName: "Straight jean" });
const ref = { faceId: tile.faceId, productId: "a", col: 0, row: 0, depth: 0 };
const slim = { productId: "slim", productName: "Slim jean", styleNumber: "S-9", colSpan: 2, rowSpan: 2 };
const change = (version: number): ChangeRow => ({ id: "c1", version, kind: "replace", target: tile, replacement: slim, pieceCount: 4 });
const draftOf = (version: number, changes: ChangeRow[]): AdjustmentState => ({
  id: "adj", planogramId: "p", state: "draft", basedOnVersion: 3, version, createdByName: "Sam", createdAt: new Date(), publishedAt: null, publishedByName: null, changes,
});
const saved = (draft: AdjustmentState) => ({ status: "saved", draft, looks: {} });

const setup = (draft: AdjustmentState | null = null, onGone = vi.fn()) =>
  renderHook(() => useAdjustment({ fixtureId: "fx", entries: [tile], draft, published: null, looks: {}, onGone }));

beforeEach(() => vi.clearAllMocks());

describe("useAdjustment", () => {
  it("a choice with no draft opens one first, then saves the change with no version (it is new)", async () => {
    actions.openAdjustmentAction.mockResolvedValue(saved(draftOf(1, [])));
    actions.setChangeAction.mockResolvedValue(saved(draftOf(2, [change(0)])));
    const { result } = setup();
    let refusal: string | null = "x";
    await act(async () => void (refusal = await result.current.choose(tile, { kind: "replace", productId: "slim" })));
    expect(refusal).toBeNull();
    expect(actions.openAdjustmentAction).toHaveBeenCalledWith("fx");
    expect(actions.setChangeAction).toHaveBeenCalledWith("fx", "adj", ref, { kind: "replace", productId: "slim" }, null);
    expect(result.current.changes).toHaveLength(1);
    expect(result.current.announcement).toBe("Slim jean replaces Straight jean");
  });

  it("does not open a draft or send anything for the choice a tile already has", async () => {
    const { result } = setup();
    await act(async () => void (await result.current.choose(tile, { kind: "keep" })));
    expect(actions.openAdjustmentAction).not.toHaveBeenCalled();
    expect(actions.setChangeAction).not.toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);
  });

  it("Undo sends the choice before, under the row's version as it is now, and Redo sends it again", async () => {
    actions.setChangeAction.mockResolvedValueOnce(saved(draftOf(2, [change(0)]))).mockResolvedValueOnce(saved(draftOf(3, []))).mockResolvedValueOnce(saved(draftOf(4, [change(0)])));
    const { result } = setup(draftOf(1, []));
    await act(async () => void (await result.current.choose(tile, { kind: "replace", productId: "slim" })));
    expect(result.current.canUndo).toBe(true);
    await act(async () => void (await result.current.undo()));
    expect(actions.setChangeAction).toHaveBeenLastCalledWith("fx", "adj", ref, { kind: "keep" }, 0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    await act(async () => void (await result.current.redo()));
    expect(actions.setChangeAction).toHaveBeenLastCalledWith("fx", "adj", ref, { kind: "replace", productId: "slim" }, null);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it("a conflict clears the history, takes the draft that came back and says why; the refusal is handed to the caller", async () => {
    actions.setChangeAction.mockResolvedValueOnce(saved(draftOf(2, [change(0)])));
    const { result } = setup(draftOf(1, []));
    await act(async () => void (await result.current.choose(tile, { kind: "replace", productId: "slim" })));
    expect(result.current.canUndo).toBe(true);
    actions.setChangeAction.mockResolvedValueOnce({ status: "refused", message: "Changed on another device", draft: draftOf(5, []) });
    let refusal: string | null = null;
    await act(async () => void (refusal = await result.current.choose(tile, { kind: "empty" })));
    expect(refusal).toBe("Changed on another device");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.changes).toHaveLength(0);
    expect(result.current.status).toEqual({ kind: "refused", message: "Changed on another device" });
  });

  it("a draft that is gone (published or discarded elsewhere) clears the history and tells the screen to reload", async () => {
    actions.setChangeAction.mockResolvedValueOnce(saved(draftOf(2, [change(0)])));
    const onGone = vi.fn();
    const { result } = setup(draftOf(1, []), onGone);
    await act(async () => void (await result.current.choose(tile, { kind: "replace", productId: "slim" })));
    actions.setChangeAction.mockResolvedValueOnce({ status: "refused", message: "Changed on another device", draft: null });
    await act(async () => void (await result.current.choose(tile, { kind: "empty" })));
    await waitFor(() => expect(onGone).toHaveBeenCalledTimes(1));
    expect(result.current.canUndo).toBe(false);
  });

  it("a refusal that is not a conflict keeps the history and says why", async () => {
    actions.setChangeAction.mockResolvedValueOnce(saved(draftOf(2, [change(0)])));
    const { result } = setup(draftOf(1, []));
    await act(async () => void (await result.current.choose(tile, { kind: "replace", productId: "slim" })));
    actions.setChangeAction.mockResolvedValueOnce({ status: "refused", message: "Tee doesn't fit there.", draft: draftOf(2, [change(0)]) });
    let refusal: string | null = null;
    await act(async () => void (refusal = await result.current.choose(tile, { kind: "replace", productId: "tee" })));
    expect(refusal).toBe("Tee doesn't fit there.");
    expect(result.current.canUndo).toBe(true);
  });
});
