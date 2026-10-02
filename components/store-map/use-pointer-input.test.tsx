import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePointerInput } from "./use-pointer-input";

function Harness({ order }: { order: string[] }) {
  const pointer = usePointerInput({
    hit: () => {
      order.push("hit");
      return { kind: "empty" };
    },
    canDrag: () => false,
    onEffect: vi.fn(),
    onWheel: vi.fn(),
  });
  return (
    <>
      <input aria-label="Name" onBlur={() => order.push("blur")} />
      <svg role="img" aria-label="Map" {...pointer.handlers} />
    </>
  );
}

describe("usePointerInput", () => {
  it("commits a field being typed in before the press on the map is read", () => {
    const order: string[] = [];
    render(<Harness order={order} />);
    const field = screen.getByRole("textbox", { name: "Name" });
    field.focus();
    fireEvent.pointerDown(screen.getByRole("img", { name: "Map" }), { pointerId: 1, pointerType: "touch" });
    expect(document.activeElement).not.toBe(field);
    expect(order).toEqual(["blur", "hit"]);
  });

  it("keeps reset the same between renders, so key listeners are not re-attached", () => {
    const options = { hit: () => ({ kind: "empty" as const }), canDrag: () => false, onEffect: vi.fn(), onWheel: vi.fn() };
    const { result, rerender } = renderHook(() => usePointerInput(options));
    const first = result.current.reset;
    rerender();
    expect(result.current.reset).toBe(first);
  });
});
