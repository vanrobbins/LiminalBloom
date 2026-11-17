import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Edge } from "@/lib/planograms/builder/resize";
import type { Rect } from "@/lib/planograms/set-grid";

import { TileCorners, targetSize } from "./tile-corners";

const EDGES: readonly Edge[] = ["left", "right", "top", "bottom"];
const bounds = { width: 12, height: 8 };
// 20 px a unit: a 5 x 5 tile is 100 px, roomy; the rest are under 88.
const roomy: Rect = { x: 3, y: 2, width: 5, height: 5 };

const props = (over: Partial<React.ComponentProps<typeof TileCorners>> = {}) => ({
  name: "Pant",
  rect: roomy,
  bounds,
  edges: EDGES,
  cellPx: 20,
  shown: true,
  instant: true,
  onRemove: vi.fn(),
  onEdit: vi.fn(),
  onEscape: vi.fn(),
  ...over,
});
const disc = (name: string) => document.querySelector<HTMLElement>(`[data-corner="${name}"]`)!;

describe("TileCorners", () => {
  afterEach(() => vi.useRealTimers());

  it("is a trash disc then a pencil disc, in that tab order, each named for the tile", () => {
    render(<TileCorners {...props()} />);
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Remove Pant", "Edit Pant"]);
    expect(disc("trash").compareDocumentPosition(disc("pencil")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("trash removes and pencil edits, each once", async () => {
    const p = props();
    render(<TileCorners {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Pant" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit Pant" }));
    expect(p.onRemove).toHaveBeenCalledTimes(1);
    expect(p.onEdit).toHaveBeenCalledTimes(1);
  });

  // The discs sit inside the face-swipe scroller: a sloppy tap must not start a swipe (KEEP_TOUCH, grid-units.ts).
  it("a touch on a disc stays on the disc, so it can't start a face swipe or a scroll", () => {
    const swipe = { start: vi.fn(), end: vi.fn() };
    render(
      <div onTouchStart={swipe.start} onTouchEnd={swipe.end}>
        <TileCorners {...props()} />
      </div>,
    );
    for (const name of ["trash", "pencil"]) {
      fireEvent.touchStart(disc(name), { touches: [{ clientX: 0, clientY: 0 }] });
      fireEvent.touchEnd(disc(name), { changedTouches: [{ clientX: 0, clientY: 0 }] });
    }
    expect(swipe.start).not.toHaveBeenCalled();
    expect(swipe.end).not.toHaveBeenCalled();
  });

  it("Escape on either disc deselects", () => {
    const p = props();
    render(<TileCorners {...p} />);
    fireEvent.keyDown(disc("trash"), { key: "Escape" });
    fireEvent.keyDown(disc("pencil"), { key: "Escape" });
    expect(p.onEscape).toHaveBeenCalledTimes(2);
  });

  it("a roomy tile in the middle has the trash centred on its top-right corner and a bigger pencil inside its bottom-right", () => {
    render(<TileCorners {...props()} />);
    expect(disc("trash")).toHaveAttribute("data-x", "mid");
    expect(disc("trash")).toHaveAttribute("data-y", "mid");
    expect(disc("pencil")).toHaveAttribute("data-x", "in");
    expect(disc("pencil")).toHaveAttribute("data-y", "in");
    // 44 px target, 28 px disc, the target's centre on the corner: trash at (8, 2) units.
    expect(disc("trash").style.width).toBe("44px");
    expect(disc("trash").style.left).toBe("calc(calc(var(--cell) * 8) + -22px)");
    expect(disc("trash").style.top).toBe("calc(calc(var(--cell) * 2) + -22px)");
    expect(disc("trash").firstElementChild).toHaveStyle({ width: "28px", height: "28px" });
    // The pencil's target ends at the corner (8, 7), over the tile, with a 36 px disc.
    expect(disc("pencil").style.left).toBe("calc(calc(var(--cell) * 8) + -44px)");
    expect(disc("pencil").style.top).toBe("calc(calc(var(--cell) * 7) + -44px)");
    expect(disc("pencil").firstElementChild).toHaveStyle({ width: "36px", height: "36px" });
  });

  // The drawing space is clipped at all four sides, so a disc on an edge turns inward over the tile.
  it.each([
    ["right", { x: 7, y: 2, width: 5, height: 5 }, "x"],
    ["top", { x: 3, y: 0, width: 5, height: 5 }, "y"],
  ] as const)("at the grid's %s edge the trash turns inward, the other axis stays put", (_edge, rect, axis) => {
    render(<TileCorners {...props({ rect })} />);
    const other = axis === "x" ? "y" : "x";
    expect(disc("trash")).toHaveAttribute(`data-${axis}`, "in");
    expect(disc("trash")).toHaveAttribute(`data-${other}`, "mid");
  });

  it("the left and bottom edges don't move the trash, and a roomy tile's pencil is inside wherever it is", () => {
    for (const rect of [roomy, { x: 0, y: 3, width: 5, height: 5 }, { x: 7, y: 0, width: 5, height: 5 }]) {
      const { unmount } = render(<TileCorners {...props({ rect })} />);
      expect(disc("pencil")).toHaveAttribute("data-x", "in");
      expect(disc("pencil")).toHaveAttribute("data-y", "in");
      if (rect.x === 0) expect(disc("trash")).toHaveAttribute("data-x", "mid");
      unmount();
    }
  });

  it("inward means the target ends at the corner and reaches over the tile", () => {
    render(<TileCorners {...props({ rect: { x: 7, y: 0, width: 5, height: 5 } })} />);
    // In the grid's corner both handles turn inward too, so the targets shrink; the trash still ends at the corner.
    const size = parseInt(disc("trash").style.width);
    expect(size).toBeLessThan(44);
    expect(disc("trash").style.left).toBe(`calc(calc(var(--cell) * 12) + -${size}px)`);
    expect(disc("trash").style.top).toBe("calc(calc(var(--cell) * 0) + 0px)");
  });

  it("under 88 px on either axis both discs sit fully outside their corners, the pencil at its 28 px; 88 px is roomy", () => {
    const { rerender } = render(<TileCorners {...props({ rect: { x: 3, y: 2, width: 4, height: 2 } })} />);
    for (const name of ["trash", "pencil"]) {
      expect(disc(name)).toHaveAttribute("data-x", "out");
      expect(disc(name)).toHaveAttribute("data-y", "out");
    }
    // 80 x 40 px: the biggest target that still clears the edge handles is the tile's 40 px short side.
    expect(disc("trash").style.left).toBe("calc(calc(var(--cell) * 7) + 0px)");
    expect(disc("trash").style.top).toBe("calc(calc(var(--cell) * 2) + -40px)");
    expect(disc("pencil").style.left).toBe("calc(calc(var(--cell) * 7) + 0px)");
    expect(disc("pencil").style.top).toBe("calc(calc(var(--cell) * 4) + 0px)");
    expect(disc("pencil").firstElementChild).toHaveStyle({ width: "36px" });
    // Wide but short is still small.
    rerender(<TileCorners {...props({ rect: { x: 3, y: 2, width: 8, height: 2 } })} />);
    expect(disc("trash")).toHaveAttribute("data-x", "out");
    // 4 x 4 units at 22 px is exactly 88 px each way.
    rerender(<TileCorners {...props({ rect: { x: 3, y: 2, width: 4, height: 4 }, cellPx: 22 })} />);
    expect(disc("trash")).toHaveAttribute("data-x", "mid");
  });

  it("rides a layered tile's offset (right and up), so it stays on the layer's painted box", () => {
    render(<TileCorners {...props({ shift: 12 })} />);
    expect(disc("trash").style.left).toBe("calc(calc(var(--cell) * 8) + -10px)");
    expect(disc("trash").style.top).toBe("calc(calc(var(--cell) * 2) + -34px)");
  });

  it("is mounted only while shown; with motion it leaves after 90 ms", () => {
    vi.useFakeTimers();
    const { rerender, container } = render(<TileCorners {...props({ instant: false })} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    rerender(<TileCorners {...props({ instant: false, shown: false })} />);
    // Leaving: out of the tab order and the accessibility tree already, still drawn for its exit.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.querySelectorAll("[data-corner][inert]")).toHaveLength(2);
    act(() => void vi.advanceTimersByTime(89));
    expect(container.querySelectorAll("[data-corner]")).toHaveLength(2);
    act(() => void vi.advanceTimersByTime(1));
    expect(container.querySelectorAll("[data-corner]")).toHaveLength(0);
  });

  it("a keyboard move shows and hides it at once, with no animation", () => {
    const { rerender, container } = render(<TileCorners {...props({ instant: true })} />);
    expect(disc("trash").className).not.toContain("animate-disc");
    rerender(<TileCorners {...props({ instant: true, shown: false })} />);
    expect(container.querySelectorAll("[data-corner]")).toHaveLength(0);
  });

  it("animates in and out only behind motion-safe, with the enter and exit tokens", () => {
    const { rerender } = render(<TileCorners {...props({ instant: false })} />);
    expect(disc("trash").className).toContain("motion-safe:animate-disc-in");
    rerender(<TileCorners {...props({ instant: false, shown: false })} />);
    expect(disc("trash").className).toContain("motion-safe:animate-disc-out");
    expect(disc("trash").className).not.toContain("motion-safe:animate-disc-in");
  });
});

describe("targetSize", () => {
  const at = (rect: Rect, cellPx = 20, edges = EDGES) => targetSize(rect, bounds, edges, cellPx);

  it("is the full 44 px on a roomy tile, and when the cell size isn't known yet", () => {
    expect(at(roomy)).toBe(44);
    expect(at({ x: 3, y: 2, width: 1, height: 1 }, 0)).toBe(44);
  });

  it("shrinks until the discs and the resize handles clear each other, never under 24 px", () => {
    const small = at({ x: 3, y: 2, width: 2, height: 2 });
    expect(small).toBeLessThan(44);
    expect(small).toBeGreaterThanOrEqual(24);
    expect(small).toBeLessThanOrEqual(40);
    // 1 unit = 20 px: nothing clears, so it stops at the floor.
    expect(at({ x: 3, y: 2, width: 1, height: 1 })).toBe(24);
  });

  it("an edge the tile can't be resized from has no handle to clear", () => {
    expect(at({ x: 3, y: 2, width: 2, height: 2 }, 20, [])).toBe(44);
  });
});
