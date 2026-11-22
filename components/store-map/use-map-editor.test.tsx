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

const initial = { ...store(), fixtures: [fixture()] };
const move = (dx: number) => ({ type: "command" as const, command: { type: "move" as const, ids: ["fixture-a"], delta: { x: dx, y: 0 } } });

/** A server that saves whatever it gets, bumping versions, after `ms`. */
function fakeServer(ms = 100) {
  let layout = initial;
  const calls: ChangeSet[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const save = vi.fn(async (_storeId: string, changes: ChangeSet): Promise<SaveReply> => {
    calls.push(changes);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, ms));
    inFlight--;
    const next = applyChanges(layout, changes);
    layout = { ...next, fixtures: next.fixtures.map((f) => ({ ...f, version: f.version + 1 })) };
    return { status: "saved", layout };
  });
  return { save, calls, maxInFlight: () => maxInFlight };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  push.mockReset();
  vi.mocked(toast).mockReset();
});

const two = { ...store(), fixtures: [fixture(), fixture({ id: "fixture-b", name: "Table 2", x: 400 })] };
const moveB = { type: "command" as const, command: { type: "move" as const, ids: ["fixture-b"], delta: { x: 12, y: 0 } } };

describe("useMapEditor", () => {

  it("saves 600 ms after a change, one request at a time, and ends saved", async () => {
    const server = fakeServer();
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial, save: server.save, fetchLatest: vi.fn() }));

    act(() => result.current.dispatch(move(12)));
    expect(result.current.status).toBe("saving");

    await act(() => vi.advanceTimersByTimeAsync(600)); // first save starts
    act(() => result.current.dispatch(move(12))); // edit while it is in flight
    // React holds renders and effects until act exits, so let the reply land (100 ms) first...
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(server.calls).toHaveLength(1);
    // ...then the follow-up goes 600 ms later, not before.
    await act(() => vi.advanceTimersByTimeAsync(599));
    expect(server.calls).toHaveLength(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(server.calls).toHaveLength(2);
    await act(() => vi.advanceTimersByTimeAsync(2000));

    expect(server.maxInFlight()).toBe(1);
    expect(server.calls).toHaveLength(2);
    expect(result.current.session.layout.fixtures[0].x).toBe(324);
    expect(result.current.status).toBe("saved");
  });

  it("stops and goes to sign-in when the session has expired (Review Focus 5)", async () => {
    const save = vi.fn(async (): Promise<SaveReply> => ({ status: "signed-out" }));
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial, save, fetchLatest: vi.fn() }));

    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(save).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/sign-in");
    expect(result.current.refusal).toBe("You were signed out. Your last change was not saved. Sign in to keep editing.");
    expect(toast).not.toHaveBeenCalled();
  });

  it("a role that can't change the map is told on the save status, and nothing more is saved", async () => {
    const save = vi.fn(async (): Promise<SaveReply> => ({ status: "forbidden" }));
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial, save, fetchLatest: vi.fn() }));

    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(600));
    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.refusal).toBe("Your role can't change the map. Your last change was not saved.");
    expect(toast).not.toHaveBeenCalled();
  });

  it("a refusal stays until a later save lands, then goes", async () => {
    const issue = { itemId: "fixture-a", kind: "outside-store" as const, message: "Table 1 must be inside the store." };
    const save = vi.fn(async (_s: string, changes: ChangeSet): Promise<SaveReply> => {
      if (save.mock.calls.length === 1) return { status: "invalid", issues: [issue], layout: two };
      return { status: "saved", layout: applyChanges(two, changes) };
    });
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial: two, save, fetchLatest: vi.fn() }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(result.current.refusal).toBe(issue.message);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.refusal).toBe(issue.message);

    act(() => result.current.dispatch(moveB));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.refusal).toBeNull();
    errorLog.mockRestore();
  });

  it("shows offline and retries after a network failure", async () => {
    let fail = true;
    const save = vi.fn(async (_s: string, changes: ChangeSet): Promise<SaveReply> => {
      if (fail) throw new Error("network");
      return { status: "saved", layout: applyChanges(initial, changes) };
    });
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial, save, fetchLatest: vi.fn() }));

    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(result.current.status).toBe("offline");

    fail = false;
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });
});
