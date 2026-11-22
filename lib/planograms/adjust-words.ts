// The words around a Quick Adjust that more than one screen says (0.7.0.9 spec §4.4, §6.3), pure.

import { targetKey, type AdjustmentState, type EndingAdjustment } from "./adjust";
import type { ProductLook, SnapshotEntry } from "./types";

/** One change of an adjustment a publish ends: "Straight jean → Slim jean (Wall bay 3)". */
export function endingWords(change: EndingAdjustment["changes"][number]): string {
  return `${change.from} → ${change.to ?? "left empty"} (${change.fixtureName})`;
}

/** What a revert puts back, one sentence per tile: "Straight jean goes back on Wall bay 3, though it is sold out." */
export function revertWords(published: AdjustmentState, latest: readonly SnapshotEntry[], looks: Readonly<Record<string, ProductLook>>): string[] {
  return published.changes.flatMap((c) => {
    const tile = latest.find((e) => targetKey(e) === targetKey(c.target));
    if (!tile) return [];
    const soldOut = looks[tile.productId]?.status === "sold_out" ? ", though it is sold out" : "";
    return [`${tile.productName} goes back on ${tile.fixtureName}${soldOut}.`];
  });
}
