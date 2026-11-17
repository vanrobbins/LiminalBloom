import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { useLongPress } from "./use-long-press";

// A touch press held ~500 ms shows the name and eats the click (0.7.0.5 R1).
function setup() {
  const onClick = vi.fn();
  render(
    <Button icon aria-label="Undo" onClick={onClick}>
      U
    </Button>,
  );
  return { onClick, button: screen.getByRole("button", { name: "Undo" }) };
}

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const touch = (x = 10, y = 10) => ({ pointerType: "touch", pointerId: 1, clientX: x, clientY: y });
// What a finger does after a press: pointerup, then the click the browser synthesises.
function release(button: HTMLElement) {
  fireEvent.pointerUp(button, touch());
  fireEvent.click(button);
}

describe("long press on a touch icon button", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the name after 500 ms and fires no click", () => {
    const { onClick, button } = setup();
    fireEvent.pointerDown(button, touch());
    wait(499);
    expect(screen.queryByRole("tooltip")).toBeNull();
    wait(2);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Undo");
    release(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("closes on an outside tap", () => {
    const { button } = setup();
    fireEvent.pointerDown(button, touch());
    wait(600);
    release(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    wait(1); // Radix arms its outside listener a tick after opening
    fireEvent.pointerDown(document.body, touch());
    fireEvent.click(document.body); // Radix dismisses a touch outside-press on its click
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("clicks on a short tap and shows no name", () => {
    const { onClick, button } = setup();
    fireEvent.pointerDown(button, touch());
    wait(100);
    release(button);
    wait(1000);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("is cancelled by movement past the tap threshold", () => {
    const { button } = setup();
    fireEvent.pointerDown(button, touch(10, 10));
    fireEvent.pointerMove(button, touch(30, 10));
    wait(700);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps a wobble inside the threshold", () => {
    const { button } = setup();
    fireEvent.pointerDown(button, touch(10, 10));
    fireEvent.pointerMove(button, touch(12, 11));
    wait(600);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("leaves mouse hover as it was: opens after the delay", () => {
    const { button } = setup();
    fireEvent.pointerMove(button, { pointerType: "mouse", pointerId: 1 });
    wait(399);
    expect(screen.queryByRole("tooltip")).toBeNull();
    wait(2);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Undo");
  });

  it("a mouse press held still shows no name and still clicks", () => {
    const { onClick, button } = setup();
    fireEvent.pointerDown(button, { pointerType: "mouse", pointerId: 1 });
    wait(700);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerUp(button, { pointerType: "mouse", pointerId: 1 });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("long press edge cases", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a genuine tap after a long press whose click never came still clicks", () => {
    const { onClick, button } = setup();
    fireEvent.pointerDown(button, touch());
    wait(600);
    fireEvent.pointerUp(button, touch()); // no click follows
    fireEvent.pointerDown(button, touch());
    release(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("a keyboard click after a long press with no click, once the window has passed, fires", () => {
    const { onClick, button } = setup();
    fireEvent.pointerDown(button, touch());
    wait(600);
    fireEvent.pointerUp(button, touch());
    wait(500);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("pointercancel mid-press shows no name and the next tap clicks", () => {
    const { onClick, button } = setup();
    fireEvent.pointerDown(button, touch());
    fireEvent.pointerCancel(button, touch());
    wait(700);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("pointercancel after the name shows clears the suppression", () => {
    const { onClick, button } = setup();
    fireEvent.pointerDown(button, touch());
    wait(600);
    fireEvent.pointerCancel(button, touch());
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("the caller's own pointerdown and click still run", () => {
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    render(
      <Button icon aria-label="Undo" onPointerDown={onPointerDown} onClick={onClick}>
        U
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Undo" });
    fireEvent.pointerDown(button, touch());
    release(button);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("unmounting mid-press cancels the timer", () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() => useLongPress(onLongPress));
    act(() => result.current.onPointerDown({ pointerType: "touch", clientX: 1, clientY: 1 } as React.PointerEvent));
    unmount();
    wait(700);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("a move of exactly 4 px cancels, like a drag starts at 4 px", () => {
    const { button } = setup();
    fireEvent.pointerDown(button, touch(10, 10));
    fireEvent.pointerMove(button, touch(14, 10));
    wait(700);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("a move of 3 px is still a still press", () => {
    const { button } = setup();
    fireEvent.pointerDown(button, touch(10, 10));
    fireEvent.pointerMove(button, touch(13, 10));
    wait(600);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("a second finger does not restart the press", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    const down = (id: number) =>
      act(() => result.current.onPointerDown({ pointerType: "touch", pointerId: id, clientX: 1, clientY: 1 } as React.PointerEvent));
    down(1);
    wait(300);
    down(2);
    wait(250);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
