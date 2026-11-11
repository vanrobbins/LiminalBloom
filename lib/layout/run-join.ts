// Joining racks by dragging (frame racks spec §4.3). A rack or run dragged near
// an open end shows where it would join, and a Link button offers the join
// after the drop. It never links by itself. A rack on its own counts as a run
// of one, so two lone racks can join too.

import { openEnds, runRacks } from "./commands-runs";
import { MAX_RUN_RACKS, isRunType, linkPoint, rackEnds, turnBetween } from "./runs";
import type { Fixture, Layout, Point } from "./types";

/** How far apart the racks' edges can be, in inches. */
export const JOIN_REACH = 12;

export type RunJoin = {
  /** The rack at the dragged chain's end. */
  rackId: string;
  /** The rack it joins, and which of that rack's ends it meets. */
  targetId: string;
  side: "left" | "right";
  /** Where the join is, for the Link button. */
  at: Point;
  /** The dragged racks in their joined places. */
  outline: Fixture[];
};

const chainOf = (layout: Layout, rack: Fixture) => (rack.runId ? runRacks(layout, rack.runId) : [rack]);

/** The dragged racks, in chain order, if they are exactly one rack or one run. */
export function movingChain(layout: Layout, ids: ReadonlySet<string>): Fixture[] | null {
  const moving = layout.fixtures.filter((f) => ids.has(f.id));
  if (moving.length === 0 || moving.length !== ids.size || moving.some((f) => !isRunType(f.type) || f.type !== moving[0].type)) return null;
  const chain = chainOf(layout, moving[0]);
  return chain.length === moving.length && chain.every((f) => ids.has(f.id)) ? chain : null;
}

/** How far the ends can be apart: a rack turned at a corner stands half its depth off the other's end. Back to back is measured from where it would sit. */
function reachOf(left: Fixture, right: Fixture, moving: Fixture): number | null {
  const turn = turnBetween(left, right);
  if (!turn) return null;
  return JOIN_REACH + (turn === "corner" ? moving.depth / 2 : 0);
}

const asItem = (f: Fixture) => ({ ...f, runIndex: f.runIndex ?? 0 });

/** The nearest open end the dragged racks could join, or null. */
export function findJoin(layout: Layout, ids: ReadonlySet<string>): RunJoin | null {
  const chain = movingChain(layout, ids);
  if (!chain) return null;
  const head = chain[0];
  const tail = chain[chain.length - 1];
  const headOpen = openEnds(layout, head.id).left;
  const tailOpen = openEnds(layout, tail.id).right;
  let best: RunJoin | null = null;
  let bestGap = Infinity;

  const consider = (rack: Fixture, target: Fixture, side: "left" | "right") => {
    const limit = side === "right" ? reachOf(target, rack, rack) : reachOf(rack, target, rack);
    if (limit === null) return;
    const from = side === "right" ? rackEnds(rack).left : rackEnds(rack).right;
    // Where the dragged end must go: the target's end, or straight behind it for back to back.
    const to = linkPoint(asItem(rack), asItem(target), side);
    if (!to) return;
    const gap = Math.hypot(to.x - from.x, to.y - from.y);
    if (gap > limit || gap >= bestGap) return;
    const dx = Math.round(to.x - from.x);
    const dy = Math.round(to.y - from.y);
    bestGap = gap;
    best = { rackId: rack.id, targetId: target.id, side, at: to, outline: chain.map((f) => ({ ...f, x: f.x + dx, y: f.y + dy })) };
  };

  for (const target of layout.fixtures) {
    if (target.type !== head.type || ids.has(target.id)) continue;
    if (chain.length + chainOf(layout, target).length > MAX_RUN_RACKS) continue;
    const open = openEnds(layout, target.id);
    if (open.right && headOpen) consider(head, target, "right");
    if (open.left && tailOpen) consider(tail, target, "left");
  }
  return best;
}
