import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyChanges, type ChangeSet } from "@/lib/layout/diff";
import type { SaveReply } from "@/lib/layout/replies";
import { fixture, store } from "@/lib/layout/test-layouts";

import { toast } from "@/lib/toast";

import { useMapEditor } from "./use-map-editor";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
// A cap of 2 lets a test pass it with three changes instead of 501.
vi.mock("@/lib/layout/limits", async (original) => ({ ...(await original<typeof import("@/lib/layout/limits")>()), MAX_CHANGES_PER_SAVE: 2 }));
const move = (dx: number) => ({ type: "command" as const, command: { type: "move" as const, ids: ["fixture-a"], delta: { x: dx, y: 0 } } });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  push.mockReset();
  vi.mocked(toast).mockReset();
});

const two = { ...store(), fixtures: [fixture(), fixture({ id: "fixture-b", name: "Table 2", x: 400 })] };
const moveB = { type: "command" as const, command: { type: "move" as const, ids: ["fixture-b"], delta: { x: 12, y: 0 } } };

describe("useMapEditor", () => {

  it("an invalid reply keeps the other pending edits and their undo, and shows the first issue", async () => {
    const issue = { itemId: "fixture-a", kind: "outside-store" as const, message: "Table 1 must be inside the store." };
    const save = vi.fn(async (_s: string, changes: ChangeSet): Promise<SaveReply> => {
      if (save.mock.calls.length === 1) return { status: "invalid", issues: [issue], layout: two };
      return { status: "saved", layout: applyChanges(two, changes) };
    });
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial: two, save, fetchLatest: vi.fn() }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    act(() => result.current.dispatch(move(12)));
    act(() => result.current.dispatch(moveB));
    await act(() => vi.advanceTimersByTimeAsync(600));

    const layout = result.current.session.layout;
    expect(layout.fixtures.find((f) => f.id === "fixture-a")!.x).toBe(300);
    expect(layout.fixtures.find((f) => f.id === "fixture-b")!.x).toBe(412);
    expect(result.current.refusal).toBe(issue.message);
    expect(toast).not.toHaveBeenCalled();

    act(() => result.current.dispatch({ type: "undo" }));
    expect(result.current.session.layout.fixtures.find((f) => f.id === "fixture-b")!.x).toBe(400);
    errorLog.mockRestore();
  });

  it("an invalid reply about nothing it sent reloads instead of retrying for ever", async () => {
    const issue = { itemId: "fixture-b", kind: "outside-store" as const, message: "Table 2 must be inside the store." };
    const save = vi.fn(async (): Promise<SaveReply> => ({ status: "invalid", issues: [issue], layout: two }));
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial: two, save, fetchLatest: vi.fn() }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    act(() => result.current.dispatch(move(12)));
    for (let i = 0; i < 10; i++) await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(save.mock.calls.length).toBeLessThanOrEqual(2);
    expect(result.current.session.layout).toEqual(two);
    expect(result.current.refusal).toBe("Couldn't save that change. The layout was reloaded.");
    expect(toast).not.toHaveBeenCalled();
    expect(result.current.status).toBe("saved");
    errorLog.mockRestore();
  });

  it("a second invalid reply in a row reloads", async () => {
    const save = vi.fn(async (_s: string, changes: ChangeSet): Promise<SaveReply> => {
      const itemId = changes.fixtures[0].item.id;
      return { status: "invalid", issues: [{ itemId, kind: "outside-store", message: "Must be inside the store." }], layout: two };
    });
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial: two, save, fetchLatest: vi.fn() }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    act(() => result.current.dispatch(move(12)));
    act(() => result.current.dispatch(moveB));
    for (let i = 0; i < 10; i++) await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.session.layout).toEqual(two);
    expect(result.current.refusal).toBe("Couldn't save that change. The layout was reloaded.");
    expect(toast).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("over the per-save cap it keeps the changes, says how to recover, and saves once Undo brings it under (B1)", async () => {
    const three = { ...two, fixtures: [...two.fixtures, fixture({ id: "fixture-c", name: "Table 3", x: 700 })] };
    const moveC = { type: "command" as const, command: { type: "move" as const, ids: ["fixture-c"], delta: { x: 12, y: 0 } } };
    const save = vi.fn(async (_s: string, changes: ChangeSet): Promise<SaveReply> => ({ status: "saved", layout: applyChanges(three, changes) }));
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial: three, save, fetchLatest: vi.fn() }));

    act(() => {
      result.current.dispatch(move(12));
      result.current.dispatch(moveB);
      result.current.dispatch(moveC);
    });
    act(() => result.current.done());
    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(save).not.toHaveBeenCalled();
    expect(result.current.session.layout.fixtures.map((f) => f.x)).toEqual([312, 412, 712]);
    expect(result.current.leaving).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Too many changes to save at once." }));

    act(() => result.current.dispatch({ type: "undo" }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1].fixtures).toHaveLength(2);
  });
});
