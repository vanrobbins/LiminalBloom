// The arrow keys on a selected tile (Part 2 spec §4 "Keyboard"): one step is
// half a foot or one level, in screen directions; with Shift the right or
// bottom edge grows or shrinks instead. The same snapping as a drag.

import { ROW_UNITS, type GridLayout } from "../set-grid";
import type { PlacementFields } from "../types";

import { dragTarget } from "./drag";
import { resizeTarget } from "./resize";

const STEPS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export function keyTarget(layout: GridLayout, start: PlacementFields, key: string, shift: boolean): PlacementFields | null {
  const step = STEPS[key];
  const block = layout.blocks.find((b) => b.faceId === start.faceId);
  if (!step || !block) return null;
  // One column is one unit; one row is ROW_UNITS. A turned table swaps them on screen.
  const dx = step[0] * (block.turned ? ROW_UNITS : 1);
  const dy = step[1] * (block.turned ? 1 : ROW_UNITS);
  if (!shift) return dragTarget(layout, start, dx, dy);
  return resizeTarget(block, start, step[0] !== 0 ? "right" : "bottom", dx, dy);
}
