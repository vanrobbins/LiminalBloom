import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_TOASTS,
  dismissToast,
  getToasts,
  subscribeToToasts,
  toast,
} from "./toast";

beforeEach(() => {
  for (const { id } of getToasts()) {
    dismissToast(id);
  }
});

describe("toast store", () => {
  it("adds a toast with its own id", () => {
    const id = toast({ tone: "success", title: "Now working in Pioneer Place." });
    expect(getToasts()).toEqual([
      { id, tone: "success", title: "Now working in Pioneer Place." },
    ]);
  });

  it("keeps the newest last", () => {
    toast({ tone: "success", title: "First" });
    toast({ tone: "error", title: "Second" });
    expect(getToasts().map(({ title }) => title)).toEqual(["First", "Second"]);
  });

  it(`shows at most ${MAX_TOASTS}, dropping the oldest`, () => {
    for (const n of [1, 2, 3, 4]) {
      toast({ tone: "success", title: `Toast ${n}` });
    }
    expect(getToasts().map(({ title }) => title)).toEqual([
      "Toast 2",
      "Toast 3",
      "Toast 4",
    ]);
  });

  it("dismisses only the one asked for", () => {
    const first = toast({ tone: "success", title: "First" });
    toast({ tone: "success", title: "Second" });
    dismissToast(first);
    expect(getToasts().map(({ title }) => title)).toEqual(["Second"]);
  });

  it("tells subscribers about changes until they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToToasts(listener);

    toast({ tone: "success", title: "One" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    toast({ tone: "success", title: "Two" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
