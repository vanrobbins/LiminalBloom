import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fixture } from "@/lib/layout/test-layouts";

import { LINK_OFFER_MS, LinkOffer } from "./link-offer";

const join = { rackId: "b", targetId: "a", side: "right" as const, at: { x: 100, y: 100 }, outline: [fixture()] };
const camera = { x: 0, y: 0, scale: 1 };
const viewport = { width: 800, height: 600 };

describe("LinkOffer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("links the racks when pressed, and closes", () => {
    const dispatch = vi.fn();
    render(<LinkOffer offer={{}} join={join} camera={camera} viewport={viewport} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "command", command: { type: "joinRun", rackId: "b", targetId: "a", side: "right" } });
    expect(dispatch).toHaveBeenLastCalledWith({ type: "dropLinkOffer" });
  });

  it("goes away after six seconds without linking anything", () => {
    const dispatch = vi.fn();
    render(<LinkOffer offer={{}} join={join} camera={camera} viewport={viewport} dispatch={dispatch} />);
    act(() => void vi.advanceTimersByTime(LINK_OFFER_MS - 1));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(dispatch.mock.calls).toEqual([[{ type: "dropLinkOffer" }]]);
  });

  it("stays above the phone's panel when the join is low on screen", () => {
    const panel = document.createElement("div");
    panel.setAttribute("data-peek-panel", "");
    panel.getBoundingClientRect = () => ({ top: 360 }) as DOMRect;
    document.body.append(panel);
    render(<LinkOffer offer={{}} join={{ ...join, at: { x: 100, y: 550 } }} camera={camera} viewport={viewport} dispatch={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveStyle({ top: "312px" });
    panel.remove();
  });

  it("stays on the map when the join is off screen", () => {
    render(<LinkOffer offer={{}} join={{ ...join, at: { x: 5000, y: -500 } }} camera={camera} viewport={viewport} dispatch={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveStyle({ left: "752px", top: "48px" });
  });
});
