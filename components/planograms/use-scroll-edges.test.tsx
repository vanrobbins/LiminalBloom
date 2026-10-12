import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollEdges } from "./use-scroll-edges";

const observed = new Set<Element>();
let notify: () => void = () => {};

beforeEach(() => {
  observed.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        notify = cb;
      }
      observe(el: Element) {
        observed.add(el);
      }
      disconnect() {
        observed.clear();
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function Box({ face, wide }: { face: string; wide: boolean }) {
  const { ref, edges } = useScrollEdges<HTMLDivElement>(face);
  return (
    <div ref={ref} data-testid="box" data-right={edges.right ? "1" : "0"}>
      <div key={face} data-testid={`content-${face}`} data-wide={wide ? "1" : "0"} />
    </div>
  );
}

describe("useScrollEdges", () => {
  it("observes the new content and recomputes edges after the face changes", () => {
    const { rerender, getByTestId } = render(<Box face="a" wide={false} />);
    const box = getByTestId("box");
    Object.defineProperty(box, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(box, "scrollWidth", { configurable: true, value: 100 });
    expect(observed.has(getByTestId("content-a"))).toBe(true);

    Object.defineProperty(box, "scrollWidth", { configurable: true, value: 300 });
    rerender(<Box face="b" wide />);
    expect(observed.has(getByTestId("content-b"))).toBe(true);
    expect(observed.has(box)).toBe(true);
    expect(box).toHaveAttribute("data-right", "1");

    Object.defineProperty(box, "scrollWidth", { configurable: true, value: 100 });
    act(() => notify());
    expect(box).toHaveAttribute("data-right", "0");
  });

  it("recomputes when an animation inside ends (a slide inflates scrollWidth mid-flight)", () => {
    const { getByTestId } = render(<Box face="a" wide={false} />);
    const box = getByTestId("box");
    Object.defineProperty(box, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(box, "scrollWidth", { configurable: true, value: 124 });
    act(() => notify());
    expect(box).toHaveAttribute("data-right", "1");

    Object.defineProperty(box, "scrollWidth", { configurable: true, value: 100 });
    fireEvent.animationEnd(getByTestId("content-a"));
    expect(box).toHaveAttribute("data-right", "0");
  });
});
