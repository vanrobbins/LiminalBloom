import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoLoad } from "./use-auto-load";

// jsdom has no IntersectionObserver: a stand-in that records who is watching and lets a test scroll.
class FakeObserver {
  static all: FakeObserver[] = [];
  disconnected = false;
  constructor(readonly callback: (entries: { isIntersecting: boolean }[]) => void) {
    FakeObserver.all.push(this);
  }
  observe = vi.fn();
  disconnect = () => {
    this.disconnected = true;
  };
  see(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}
const live = () => FakeObserver.all.filter((o) => !o.disconnected);

function Probe({ enabled, load }: { enabled: boolean; load: () => void }) {
  const end = useAutoLoad(enabled, load);
  return <div ref={end} data-testid="end" />;
}

beforeEach(() => {
  FakeObserver.all = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe("useAutoLoad", () => {
  it("loads when the end comes into view, not before", () => {
    const load = vi.fn();
    const { getByTestId } = render(<Probe enabled load={load} />);
    const [observer] = live();
    expect(observer.observe).toHaveBeenCalledWith(getByTestId("end"));
    act(() => observer.see(false));
    expect(load).not.toHaveBeenCalled();
    act(() => observer.see(true));
    expect(load).toHaveBeenCalledOnce();
  });

  it("watches nothing when there is nothing to load, or while a page is loading", () => {
    const { rerender } = render(<Probe enabled={false} load={() => {}} />);
    expect(FakeObserver.all).toHaveLength(0);
    rerender(<Probe enabled load={() => {}} />);
    expect(live()).toHaveLength(1);
    // Switched off mid-load: the observer goes, so a second sighting can't fire a second load.
    const [first] = live();
    rerender(<Probe enabled={false} load={() => {}} />);
    expect(first.disconnected).toBe(true);
    expect(live()).toHaveLength(0);
  });

  it("watches again, with a new observer, once it is switched back on", () => {
    const load = vi.fn();
    const { rerender } = render(<Probe enabled load={load} />);
    rerender(<Probe enabled={false} load={load} />);
    rerender(<Probe enabled load={load} />);
    expect(live()).toHaveLength(1);
    act(() => live()[0].see(true));
    expect(load).toHaveBeenCalledOnce();
  });

  it("calls the newest load, without re-observing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Probe enabled load={first} />);
    rerender(<Probe enabled load={second} />);
    expect(FakeObserver.all).toHaveLength(1);
    act(() => live()[0].see(true));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("disconnects on unmount", () => {
    const { unmount } = render(<Probe enabled load={() => {}} />);
    unmount();
    expect(live()).toHaveLength(0);
  });

  it("does nothing, and does not throw, where there is no IntersectionObserver", () => {
    vi.unstubAllGlobals();
    expect(() => render(<Probe enabled load={() => {}} />)).not.toThrow();
  });
});
