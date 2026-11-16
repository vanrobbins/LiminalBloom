// The save indicator's timing (0.7.0.5 task 4, spec §2.1; Doherty): "Saving…"
// only after 300 ms, and once shown it holds at least 500 ms, so a quick save
// never flashes and a slow one never blinks away.

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DraftStatusLine, SaveIndicator } from "./draft-status";
import type { DraftStatus } from "./use-planogram-draft";

const saving: DraftStatus = { kind: "saving" };
const saved: DraftStatus = { kind: "saved" };
const idle: DraftStatus = { kind: "idle" };
const words = () => screen.getByRole("status").textContent;
const later = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("SaveIndicator", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows Saving… only after 300 ms", () => {
    render(<SaveIndicator status={saving} />);
    expect(words()).toBe("");
    later(299);
    expect(words()).toBe("");
    later(1);
    expect(words()).toBe("Saving…");
  });

  it("a save that lands inside 300 ms goes straight to Saved, with no Saving… between", () => {
    const { rerender } = render(<SaveIndicator status={idle} />);
    rerender(<SaveIndicator status={saving} />);
    later(120);
    rerender(<SaveIndicator status={saved} />);
    expect(words()).toBe("Saved");
    later(1000);
    expect(words()).toBe("Saved");
  });

  it("once Saving… shows it holds 500 ms, even when the save lands a moment after", () => {
    const { rerender } = render(<SaveIndicator status={saving} />);
    later(300);
    expect(words()).toBe("Saving…");
    later(100);
    rerender(<SaveIndicator status={saved} />);
    expect(words()).toBe("Saving…");
    later(399);
    expect(words()).toBe("Saving…");
    later(1);
    expect(words()).toBe("Saved");
  });

  it("a save that takes longer than the hold is replaced at once", () => {
    const { rerender } = render(<SaveIndicator status={saving} />);
    later(1200);
    rerender(<SaveIndicator status={saved} />);
    expect(words()).toBe("Saved");
  });

  it("a second save while one is still showing doesn't restart the 300 ms or the hold", () => {
    const { rerender } = render(<SaveIndicator status={saving} />);
    later(400);
    rerender(<SaveIndicator status={{ kind: "saving" }} />);
    expect(words()).toBe("Saving…");
    later(100);
    rerender(<SaveIndicator status={saved} />);
    // Shown at 300 ms, so held until 800 ms: not 500 ms after the second save went.
    later(299);
    expect(words()).toBe("Saving…");
    later(1);
    expect(words()).toBe("Saved");
  });

  it("a save that starts inside the hold window holds its own Saved 500 ms from where it started", () => {
    const { rerender } = render(<SaveIndicator status={saving} />);
    later(350);
    // Shown at 300 ms, so the first Saved waits until 800 ms.
    rerender(<SaveIndicator status={saved} />);
    later(250);
    rerender(<SaveIndicator status={{ kind: "saving" }} />);
    expect(words()).toBe("Saving…");
    later(50);
    rerender(<SaveIndicator status={saved} />);
    // The second save began at 600 ms: Saving… holds to 1100 ms, not the first save's 800.
    later(299);
    expect(words()).toBe("Saving…");
    later(150);
    expect(words()).toBe("Saving…");
    later(1);
    expect(words()).toBe("Saved");
  });

  it("only settled states are announced: Saving… is hidden from screen readers, Saved is not", () => {
    const { rerender } = render(<SaveIndicator status={saving} />);
    later(300);
    expect(screen.getByText("Saving…").closest("[aria-hidden='true']")).not.toBeNull();
    rerender(<SaveIndicator status={saved} />);
    later(500);
    expect(screen.getByText("Saved").closest("[aria-hidden='true']")).toBeNull();
  });

  it("is a status, not a button: nothing to focus or press", () => {
    render(<SaveIndicator status={saved} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status")).not.toHaveAttribute("tabindex");
  });

  it("keeps its words for screen readers where only the icon shows", () => {
    render(<SaveIndicator status={saved} />);
    expect(screen.getByText("Saved")).toHaveClass("sr-only", "sm:not-sr-only");
  });

  it("a refusal shows its alert icon at once and leaves the words to the line below", () => {
    const { container } = render(<SaveIndicator status={{ kind: "refused", message: "Blocked by Pant" }} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("Blocked by Pant")).toBeNull();
  });
});

describe("DraftStatusLine", () => {
  it("says why a change was refused, politely, and says nothing otherwise", () => {
    const { rerender } = render(<DraftStatusLine status={{ kind: "refused", message: "Blocked by Pant" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Blocked by Pant");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    // The live region stays mounted, empty, so the next refusal is announced.
    rerender(<DraftStatusLine status={saved} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
