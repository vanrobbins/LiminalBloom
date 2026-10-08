// Flat garment shapes (spec §6.4): the seed draws each demo product in its own
// color, and the app shows the same shape, in a neutral token, for a product
// without a photo. Plain data so the seed script (Node, no JSX) can use it.

export type Silhouette = "tee" | "knit" | "pants" | "dress" | "outerwear" | "accessory";

/** Path data in a 100 × 120 box. */
export const SILHOUETTE_PATHS: Record<Silhouette, string> = {
  tee: "M30 10 L45 6 Q50 14 55 6 L70 10 L92 28 L80 42 L72 36 L72 112 L28 112 L28 36 L20 42 L8 28 Z",
  knit: "M32 10 L45 6 Q50 14 55 6 L68 10 L84 22 L96 100 L84 102 L72 40 L72 112 L28 112 L28 40 L16 102 L4 100 L16 22 Z",
  pants: "M28 8 L72 8 L80 112 L58 112 L50 40 L42 112 L20 112 Z",
  dress: "M38 6 L44 6 Q50 14 56 6 L62 6 L64 30 L58 40 L88 112 L12 112 L42 40 L36 30 Z",
  outerwear: "M30 8 L44 4 L50 20 L56 4 L70 8 L90 26 L94 104 L80 104 L76 44 L76 114 L24 114 L24 44 L20 104 L6 104 L10 26 Z",
  accessory: "M36 40 Q36 18 50 18 Q64 18 64 40 L58 40 Q58 26 50 26 Q42 26 42 40 Z M18 40 L82 40 L88 110 L12 110 Z",
};

const KEYWORDS: [RegExp, Silhouette][] = [
  [/knit|sweater|cardigan|long.?sleeve/i, "knit"],
  [/denim|jean|pant|trouser|short|legging/i, "pants"],
  [/dress|skirt/i, "dress"],
  [/outer|coat|jacket|blazer/i, "outerwear"],
  [/accessor|bag|hat|scarf|belt|jewel/i, "accessory"],
];

export function silhouetteFor(categoryName: string): Silhouette {
  return KEYWORDS.find(([pattern]) => pattern.test(categoryName))?.[1] ?? "tee";
}

export function silhouetteSvg(kind: Silhouette, fill: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(fill)) throw new Error(`Not a #rrggbb color: ${fill}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="400" height="480"><rect width="100" height="120" fill="#f7f2ea"/><path d="${SILHOUETTE_PATHS[kind]}" fill="${fill}" fill-rule="evenodd"/></svg>`;
}
