// Helpers shared by the layout rules in validate.ts and validate-fixtures.ts.

import { selfIntersects } from "./crossings";
import { MAX_COORD, MAX_CORNERS, MAX_NAME } from "./limits";
import type { Issue, IssueKind, Layout, Point } from "./types";

export type Wants = (id: string) => boolean;

export function issue(itemId: string, kind: IssueKind, message: string, blockerId?: string): Issue {
  return blockerId === undefined ? { itemId, kind, message } : { itemId, kind, message, blockerId };
}

export const offMap = (p: Point) => p.x < 0 || p.y < 0 || p.x > MAX_COORD || p.y > MAX_COORD;
export const nameKey = (name: string) => name.trim().toLowerCase();
export const goodName = (name: string) => name.trim().length >= 1 && name.trim().length <= MAX_NAME;
/** A shape the overlap and containment tests can trust. */
export const isSimple = (points: Point[]) =>
  points.length >= 3 && points.length <= MAX_CORNERS && !selfIntersects(points);

/** The outline, if it is sound enough to test containment against. */
export function usableOutline(layout: Layout): Point[] | null {
  return layout.outline && isSimple(layout.outline.points) ? layout.outline.points : null;
}
