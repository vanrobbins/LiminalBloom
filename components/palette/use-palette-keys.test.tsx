import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePaletteKeys } from "./use-palette-keys";

function Host({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  usePaletteKeys(open, setOpen);
  return (
    <>
      <input aria-label="field" />
      <div contentEditable suppressContentEditableWarning aria-label="rich" />
    </>
  );
}

const press = (target: Element | Window, init: KeyboardEventInit) => {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

afterEach(() => (document.body.innerHTML = ""));

describe("usePaletteKeys", () => {
  it("Ctrl+K and Cmd+K open and prevent the browser's own handling", () => {
    const setOpen = vi.fn();
    render(<Host open={false} setOpen={setOpen} />);
    expect(press(window, { key: "k", ctrlKey: true }).defaultPrevented).toBe(true);
    press(window, { key: "K", metaKey: true });
    expect(setOpen).toHaveBeenNthCalledWith(1, true);
    expect(setOpen).toHaveBeenNthCalledWith(2, true);
  });

  it("toggles: pressed while open it closes", () => {
    const setOpen = vi.fn();
    render(<Host open setOpen={setOpen} />);
    press(window, { key: "k", ctrlKey: true });
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("works while typing in a field", () => {
    const setOpen = vi.fn();
    const { getByLabelText } = render(<Host open={false} setOpen={setOpen} />);
    press(getByLabelText("field"), { key: "k", ctrlKey: true });
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it.each([
    ["Alt", { altKey: true }],
    ["Shift", { shiftKey: true }],
    ["a repeat", { repeat: true }],
    ["IME composition", { isComposing: true }],
  ])("ignores Ctrl+K with %s", (_, extra) => {
    const setOpen = vi.fn();
    render(<Host open={false} setOpen={setOpen} />);
    const event = press(window, { key: "k", ctrlKey: true, ...extra });
    expect(setOpen).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does not open over another modal dialog, but still stops the browser's shortcut", () => {
    const setOpen = vi.fn();
    render(<Host open={false} setOpen={setOpen} />);
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    document.body.append(other);
    const event = press(window, { key: "k", ctrlKey: true });
    expect(setOpen).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("opens over a non-modal popover (the info buttons render role=dialog inside Radix's popper wrapper)", () => {
    const setOpen = vi.fn();
    render(<Host open={false} setOpen={setOpen} />);
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-radix-popper-content-wrapper", "");
    const popover = document.createElement("div");
    popover.setAttribute("role", "dialog");
    wrapper.append(popover);
    document.body.append(wrapper);
    press(window, { key: "k", ctrlKey: true });
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it("does not open while the map editor is embedded in the page (leaving it by the palette needs its own care)", () => {
    const setOpen = vi.fn();
    render(<Host open={false} setOpen={setOpen} />);
    const editor = document.createElement("div");
    editor.setAttribute("data-embedded-editor", "");
    document.body.append(editor);
    expect(press(window, { key: "k", ctrlKey: true }).defaultPrevented).toBe(true);
    press(document.body, { key: "/" });
    expect(setOpen).not.toHaveBeenCalled();
  });

  it("still closes when the only dialog open is the palette", () => {
    const setOpen = vi.fn();
    render(<Host open setOpen={setOpen} />);
    const own = document.createElement("div");
    own.setAttribute("role", "dialog");
    own.setAttribute("data-palette", "");
    document.body.append(own);
    press(window, { key: "k", ctrlKey: true });
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("/ opens, never toggles, and is not typed", () => {
    const setOpen = vi.fn();
    const { rerender } = render(<Host open={false} setOpen={setOpen} />);
    expect(press(document.body, { key: "/" }).defaultPrevented).toBe(true);
    expect(setOpen).toHaveBeenCalledWith(true);
    setOpen.mockClear();
    rerender(<Host open setOpen={setOpen} />);
    press(document.body, { key: "/" });
    expect(setOpen).not.toHaveBeenCalled();
  });

  it("/ is left alone in a field, a contenteditable, over a dialog, or with a modifier", () => {
    const setOpen = vi.fn();
    const { getByLabelText } = render(<Host open={false} setOpen={setOpen} />);
    const typed = press(getByLabelText("field"), { key: "/" });
    expect(typed.defaultPrevented).toBe(false);
    const rich = getByLabelText("rich");
    Object.defineProperty(rich, "isContentEditable", { value: true });
    press(rich, { key: "/" });
    press(document.body, { key: "/", ctrlKey: true });
    press(document.body, { key: "/", repeat: true });
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    document.body.append(other);
    press(document.body, { key: "/" });
    expect(setOpen).not.toHaveBeenCalled();
  });

  it("stops listening when unmounted", () => {
    const setOpen = vi.fn();
    render(<Host open={false} setOpen={setOpen} />).unmount();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(setOpen).not.toHaveBeenCalled();
  });
});
