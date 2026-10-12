// Swiping the grid sideways changes face (spec §4.4). Vertical scroll always
// wins, and a grid that can still scroll in that direction scrolls instead.

import type { Edges } from "./use-scroll-edges";

export const SWIPE_MIN_PX = 48;

export function swipeTarget(
  faceIds: readonly string[],
  current: string,
  { dx, dy, edges }: { dx: number; dy: number; edges: Edges },
): { faceId: string; from: "left" | "right" } | null {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 2) return null;
  const next = dx < 0; // finger moves left: the next face comes in from the right
  if (next ? edges.right : edges.left) return null;
  const i = faceIds.indexOf(current);
  const j = next ? i + 1 : i - 1;
  if (i < 0 || j < 0 || j >= faceIds.length) return null;
  return { faceId: faceIds[j], from: next ? "right" : "left" };
}
