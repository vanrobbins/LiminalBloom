import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePlacementActions } from "./use-placement-actions";

const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

// Only what the grid's refusal path touches is real; the rest is never reached.
function setup() {
  const builder = { refuse: vi.fn(), say: vi.fn() };
  const options = {
    scope: { faces: [], isSet: false },
    face: {},
    layout: {},
    placements: [],
    items: [],
    isEditing: true,
    canMove: true,
    selectedId: null,
    builder,
    setSelectedId: vi.fn(),
    select: vi.fn(),
    showFace: vi.fn(),
    editNumbers: vi.fn(),
    onAdd: vi.fn(),
  } as unknown as Parameters<typeof usePlacementActions>[0];
  const { result } = renderHook(() => usePlacementActions(options));
  return { builder, grid: result.current.gridBuilder! };
}

describe("usePlacementActions", () => {
  it("a drop the grid refuses is told on the draft's status line, not in a toast", () => {
    const { builder, grid } = setup();
    grid.onRefused("Blocked by Tee");
    expect(builder.refuse).toHaveBeenCalledWith("Blocked by Tee");
    expect(toasts.toast).not.toHaveBeenCalled();
  });
});
