// What the Quick Adjust grids draw (0.7.0.9 spec §5.2, §5.3), from the version's entries and the changes on them.

import { itemsFromSnapshot, type GridItem } from "@/components/planograms/grid-items";
import { spotKey, targetKey, type AdjustChange } from "@/lib/planograms/adjust";
import type { ProductLook, SnapshotEntry } from "@/lib/planograms/types";

type Looks = Readonly<Record<string, ProductLook>>;

/**
 * The adjust page's tiles: one per entry of the version (`v-<index>`, which a change never moves), each as the change leaves it:
 * a replacement drawn as itself and marked "replaces X", a tile left empty (dashed, still there to tap, and to Keep again), or
 * the original, marked sold out or on sale.
 */
export function adjustItems(entries: readonly SnapshotEntry[], changes: readonly AdjustChange[], looks: Looks): GridItem[] {
  const byTarget = new Map(changes.map((c) => [targetKey(c.target), c]));
  return itemsFromSnapshot(entries, looks, true).map((item, i) => {
    const change = byTarget.get(targetKey(entries[i]));
    if (!change) return item;
    if (change.kind === "empty") return { ...item, status: undefined, adjust: { kind: "empty", was: item.productName } };
    const { productId, productName, styleNumber, colSpan, rowSpan } = change.replacement;
    const look = looks[productId];
    return {
      ...item,
      productId,
      productName,
      styleNumber,
      colSpan,
      rowSpan,
      pieceCount: change.pieceCount,
      imageKey: look?.imageKey ?? null,
      categoryName: look?.categoryName ?? "",
      swatch: look?.swatch,
      texture: look?.texture,
      colorWord: look?.colorWord,
      status: undefined,
      adjust: { kind: "replaced", from: item.productName },
    };
  });
}

/** Compare's two grids: what changes is outlined in both (Before: "will change"; After: "replaces X"). Nothing is selectable. */
export function compareItems(before: readonly SnapshotEntry[], after: readonly SnapshotEntry[], looks: Looks): { before: GridItem[]; after: GridItem[] } {
  const keep = (entries: readonly SnapshotEntry[]) => new Set(entries.map(targetKey));
  const kept = { before: keep(before), after: keep(after) };
  const was = new Map(before.map((e) => [spotKey(e), e.productName]));
  return {
    before: itemsFromSnapshot(before, looks).map((item, i) => (kept.after.has(targetKey(before[i])) ? item : { ...item, adjust: { kind: "changed" } })),
    after: itemsFromSnapshot(after, looks).map((item, i) => (kept.before.has(targetKey(after[i])) ? item : { ...item, adjust: { kind: "replaced", from: was.get(spotKey(after[i])) ?? "another product" } })),
  };
}
