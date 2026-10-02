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

  it("Done waits for the save, then goes back to the map", async () => {
    const server = fakeServer();
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial, save: server.save, fetchLatest: vi.fn() }));

    act(() => result.current.dispatch(move(12)));
    act(() => result.current.done());
    expect(result.current.leaving).toBe(true);
    expect(push).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(push).toHaveBeenCalledWith("/layout");
  });

  it("does not stay offline when the retry finds nothing to save", async () => {
    let fail = true;
    const save = vi.fn(async (_s: string, changes: ChangeSet): Promise<SaveReply> => {
      if (fail) throw new Error("network");
      return { status: "saved", layout: applyChanges(initial, changes) };
    });
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial, save, fetchLatest: vi.fn() }));

    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(result.current.status).toBe("offline");

    act(() => result.current.dispatch({ type: "undo" })); // back to what the server has
    await act(() => vi.advanceTimersByTimeAsync(1000)); // the retry fires with nothing pending
    expect(result.current.status).toBe("saved");

    fail = false;
    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("a slow focus refetch never starts a second save beside one in flight", async () => {
    const server = fakeServer(2000);
    const fetchLatest = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return { status: "ok" as const, layout: initial };
    });
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial, save: server.save, fetchLatest }));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(600)); // the save starts
    await act(() => vi.advanceTimersByTimeAsync(100)); // the refetch lands mid-save
    await act(() => vi.advanceTimersByTimeAsync(5000));
    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(server.maxInFlight()).toBe(1);
    expect(result.current.session.layout.fixtures[0].x).toBe(312);
  });

  it("after a store switch nothing more is saved and leaving the page is not blocked", async () => {
    const save = vi.fn(async (): Promise<SaveReply> => ({ status: "store-changed" }));
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial, save, fetchLatest: vi.fn() }));

    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(600));
    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(700)); // short of the 1.5 s reload

    expect(save).toHaveBeenCalledTimes(1);
    const leave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(false);
  });

  it("drops, with a message, an edit made during a save to an item another device changed meanwhile (spec §1)", async () => {
    const save = vi.fn(async (_s: string, changes: ChangeSet): Promise<SaveReply> => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const next = applyChanges(two, changes);
      const fixtures = next.fixtures.map((f) =>
        f.id === "fixture-b" ? { ...f, name: "Their table", version: 2 } : { ...f, version: f.version + 1 },
      );
      return { status: "saved", layout: { ...next, fixtures } };
    });
    const { result } = renderHook(() => useMapEditor({ storeId: "s", initial: two, save, fetchLatest: vi.fn() }));

    act(() => result.current.dispatch(move(12)));
    await act(() => vi.advanceTimersByTimeAsync(600)); // fixture-a's save starts
    act(() => result.current.dispatch(moveB)); // edit fixture-b while it is in flight
    await act(() => vi.advanceTimersByTimeAsync(100));
    await act(() => vi.advanceTimersByTimeAsync(2000));

    const b = result.current.session.layout.fixtures.find((f) => f.id === "fixture-b")!;
    expect(b).toMatchObject({ name: "Their table", x: 400 });
    expect(result.current.session.layout.fixtures[0].x).toBe(312);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Table 2 was changed on another device." }));
    expect(save).toHaveBeenCalledTimes(1);
  });

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
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: issue.message }));

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
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't save that change. The layout was reloaded." }));
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
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Couldn't save that change. The layout was reloaded." }));
    errorLog.mockRestore();
  });
});
