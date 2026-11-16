import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollapseItem } from "./collapse-item";
import { COLLAPSE_MS, useCollapseOut } from "./use-collapse-out";

describe("CollapseItem", () => {
  it("is open by default and folds shut when leaving: grid rows 1fr to 0fr, inert, still in the page", () => {
    const { rerender } = render(
      <ul>
        <CollapseItem leaving={false}>Sam</CollapseItem>
      </ul>,
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveClass("grid-rows-[1fr]");
    expect(item).not.toHaveAttribute("inert");
    rerender(
      <ul>
        <CollapseItem leaving>Sam</CollapseItem>
      </ul>,
    );
    expect(screen.getByRole("listitem", { hidden: true })).toHaveClass("grid-rows-[0fr]");
    expect(screen.getByRole("listitem", { hidden: true })).toHaveAttribute("inert");
  });

  it("animates only where motion is welcome, over 190 ms on the exit curve", () => {
    render(
      <ul>
        <CollapseItem>Sam</CollapseItem>
      </ul>,
    );
    const classes = screen.getByRole("listitem").className;
    expect(classes).toContain("motion-safe:transition-[grid-template-rows]");
    expect(classes).toContain("motion-safe:duration-[190ms]");
    expect(classes).toContain("motion-safe:ease-[var(--ease-exit)]");
  });
});

describe("useCollapseOut", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("marks the row leaving at once and runs what follows once the fold has finished", () => {
    const { result } = renderHook(() => useCollapseOut());
    const then = vi.fn();
    expect(result.current.isLeaving("a")).toBe(false);
    act(() => result.current.collapse("a", then));
    expect(result.current.isLeaving("a")).toBe(true);
    expect(result.current.isLeaving("b")).toBe(false);
    act(() => void vi.advanceTimersByTime(COLLAPSE_MS - 1));
    expect(then).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(then).toHaveBeenCalledTimes(1);
  });

  it("waits for nothing under reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { result } = renderHook(() => useCollapseOut());
    const then = vi.fn();
    act(() => result.current.collapse("a", then));
    act(() => void vi.advanceTimersByTime(0));
    expect(then).toHaveBeenCalledTimes(1);
  });

  it("does not run what follows after the screen is gone", () => {
    const { result, unmount } = renderHook(() => useCollapseOut());
    const then = vi.fn();
    act(() => result.current.collapse("a", then));
    unmount();
    vi.advanceTimersByTime(COLLAPSE_MS * 2);
    expect(then).not.toHaveBeenCalled();
  });

  it("opens the row again and says so when what follows the fold throws (the reload failed)", () => {
    const { result } = renderHook(() => useCollapseOut());
    const onFail = vi.fn();
    act(() =>
      result.current.collapse(
        "a",
        () => {
          throw new Error("refresh failed");
        },
        onFail,
      ),
    );
    expect(result.current.isLeaving("a")).toBe(true);
    act(() => void vi.advanceTimersByTime(COLLAPSE_MS));
    expect(result.current.isLeaving("a")).toBe(false);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("does the same when what follows is asynchronous and rejects", async () => {
    const { result } = renderHook(() => useCollapseOut());
    const onFail = vi.fn();
    act(() => result.current.collapse("a", () => Promise.reject(new Error("no")), onFail));
    await act(async () => void vi.advanceTimersByTime(COLLAPSE_MS));
    expect(result.current.isLeaving("a")).toBe(false);
    expect(onFail).toHaveBeenCalledTimes(1);
  });
});
