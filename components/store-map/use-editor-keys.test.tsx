import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useEditorKeys } from "./use-editor-keys";

describe("useEditorKeys", () => {
  it("maps desktop shortcuts to session actions", async () => {
    const dispatch = vi.fn();
    const reset = vi.fn();
    renderHook(() => useEditorKeys(dispatch, reset));

    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
    await userEvent.keyboard("r");
    await userEvent.keyboard("{Delete}");
    await userEvent.keyboard("{Control>}z{/Control}");
    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    await userEvent.keyboard("{Control>}d{/Control}");
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("f");

    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: "nudge", dx: 1, dy: 0 },
      { type: "nudge", dx: 0, dy: 12 },
      { type: "rotate", by: 15 },
      { type: "delete" },
      { type: "undo" },
      { type: "redo" },
      { type: "duplicate" },
      { type: "escape" },
      { type: "fit" },
    ]);
    expect(reset).toHaveBeenCalledOnce();
  });

  it("leaves keys alone while typing in a field", async () => {
    const dispatch = vi.fn();
    renderHook(() => useEditorKeys(dispatch, vi.fn()));
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    await userEvent.keyboard("{Delete}r");
    expect(dispatch).not.toHaveBeenCalled();
    input.remove();
  });

  it("turns snapping off while Alt is held", async () => {
    const dispatch = vi.fn();
    renderHook(() => useEditorKeys(dispatch, vi.fn()));
    await userEvent.keyboard("{Alt>}{/Alt}");
    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: "snapping", on: false },
      { type: "snapping", on: true },
    ]);
  });

  it("ignores keys another handler already took", async () => {
    const dispatch = vi.fn();
    renderHook(() => useEditorKeys(dispatch, vi.fn()));
    const take = (event: Event) => event.preventDefault();
    document.addEventListener("keydown", take);
    await userEvent.keyboard("{Delete}");
    document.removeEventListener("keydown", take);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("turns snapping back on when the window loses focus with Alt held", async () => {
    const dispatch = vi.fn();
    renderHook(() => useEditorKeys(dispatch, vi.fn()));
    await userEvent.keyboard("{Alt>}");
    window.dispatchEvent(new Event("blur"));
    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: "snapping", on: false },
      { type: "snapping", on: true },
    ]);
    await userEvent.keyboard("{/Alt}");
  });
});
