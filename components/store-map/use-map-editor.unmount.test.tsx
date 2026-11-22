// Leaving the embedded editor by client navigation (the nav links, the command palette) fires no
// beforeunload, so unmounting has to send what is still waiting (spec 0.7.0.8 §13), once.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyChanges, type ChangeSet } from "@/lib/layout/diff";
import type { SaveReply } from "@/lib/layout/replies";
import { fixture, store } from "@/lib/layout/test-layouts";

import { useMapEditor } from "./use-map-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const initial = { ...store(), fixtures: [fixture(), fixture({ id: "fixture-b", name: "Table 2", x: 400 })] };
const move = (id: string, dx: number) => ({ type: "command" as const, command: { type: "move" as const, ids: [id], delta: { x: dx, y: 0 } } });

function server(ms = 100, reply?: SaveReply) {
  let layout = initial;
  const calls: ChangeSet[] = [];
  const save = vi.fn(async (_storeId: string, changes: ChangeSet): Promise<SaveReply> => {
    calls.push(changes);
    await new Promise((resolve) => setTimeout(resolve, ms));
    if (reply) return reply;
    const next = applyChanges(layout, changes);
    const touched = new Set(changes.fixtures.map((u) => u.item.id));
    layout = { ...next, fixtures: next.fixtures.map((f) => (touched.has(f.id) ? { ...f, version: f.version + 1 } : f)) };
    return { status: "saved", layout };
  });
  return { save, calls };
}

const mount = (save: ReturnType<typeof server>["save"]) => renderHook(() => useMapEditor({ storeId: "s", initial, save, fetchLatest: vi.fn() }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useMapEditor unmounting", () => {
  it("sends a change that was still inside the 600 ms wait", async () => {
    const s = server();
    const { result, unmount } = mount(s.save);
    act(() => result.current.dispatch(move("fixture-a", 12)));
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(s.save).not.toHaveBeenCalled();

    unmount();
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.save).toHaveBeenCalledTimes(1);
    expect(s.calls[0].fixtures[0].item.x).toBe(312);
  });

  it("sends nothing when everything is saved", async () => {
    const s = server();
    const { result, unmount } = mount(s.save);
    act(() => result.current.dispatch(move("fixture-a", 12)));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(s.save).toHaveBeenCalledTimes(1);

    unmount();
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.save).toHaveBeenCalledTimes(1);
  });

  it("never sends over a save in flight: an edit made meanwhile goes right after it lands", async () => {
    const s = server();
    const { result, unmount } = mount(s.save);
    act(() => result.current.dispatch(move("fixture-a", 12)));
    await act(() => vi.advanceTimersByTimeAsync(600)); // first save in flight
    act(() => result.current.dispatch(move("fixture-b", 12)));

    unmount();
    expect(s.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.save).toHaveBeenCalledTimes(2);
    expect(s.calls[1].fixtures.map((u) => u.item.id)).toEqual(["fixture-b"]);
  });

  it("sends nothing once the editor has stopped (signed out)", async () => {
    const s = server(0, { status: "signed-out" });
    const { result, unmount } = mount(s.save);
    act(() => result.current.dispatch(move("fixture-a", 12)));
    await act(() => vi.advanceTimersByTimeAsync(700));
    act(() => result.current.dispatch(move("fixture-b", 12)));

    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(s.save).toHaveBeenCalledTimes(1);
  });

  it("a failed send after leaving is not retried forever", async () => {
    const save = vi.fn(async (): Promise<SaveReply> => {
      throw new Error("network");
    });
    const { result, unmount } = renderHook(() => useMapEditor({ storeId: "s", initial, save, fetchLatest: vi.fn() }));
    act(() => result.current.dispatch(move("fixture-a", 12)));
    unmount();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
