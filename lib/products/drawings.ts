// Product drawings (Week 6.5 spec §4): 12 shapes, each in 4 views, as plain
// path data in a 100 × 120 box, so the app and anything without JSX share it.
//
// - `body` is the filled outline (even-odd, so a handle or a strap can be a hole).
// - `details` are lines drawn over it in the darker detail tone: collar,
//   placket, waistband, cuffs, zipper, pockets, stack edges, a shelf.
//
// Views: `flat` (laid flat: cards, the location sheet, the product page),
// `hung` (as it hangs on a rail, no hanger drawn), `folded-top` (a folded stack
// seen from above, for table tops) and `folded-front` (the front of a stack on
// a shelf: about three layered edges; accessories sit on a shelf). Planograms
// never use `flat`. The piece count stays a text label: drawings never scale.

import type { Presentation } from "./footprint";

export const SHAPES = ["tee", "tank", "knit", "outerwear", "pants", "shorts", "skirt", "dress", "bag", "hat", "shoes", "scarf"] as const;
export type Shape = (typeof SHAPES)[number];

export const VIEWS = ["flat", "hung", "folded-top", "folded-front"] as const;
export type View = (typeof VIEWS)[number];

export type Drawing = { body: string; details: string };

// ---------------------------------------------------------------- helpers

/** A rounded rectangle as path data. */
function box(x: number, y: number, w: number, h: number, r = 4): string {
  return `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
}

/** An ellipse as path data (two arcs). */
function oval(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

/** A front view of a folded stack: three layers, each a little narrower than the one under it. */
function stack(width: number, top: string): Drawing {
  const x = (100 - width) / 2;
  const layers = [0, 1, 2].map((i) => box(x + i, 42 + i * 22, width - i * 2, 22, 6));
  return {
    body: layers.join(" "),
    details: `M${x + 3} 64 H${100 - x - 3} M${x + 3} 86 H${100 - x - 3} ${top}`,
  };
}

/** A folded garment seen from above: a block with its own details. */
function fromAbove(x: number, y: number, w: number, h: number, details: string): Drawing {
  return { body: box(x, y, w, h, 6), details: `${details} M${x + 4} ${y + h - 6} H${x + w - 4}` };
}

const SHELF = "M4 116 H96";

// ---------------------------------------------------------------- the shapes

const TEE_BODY = "M30 10 L45 6 Q50 15 55 6 L70 10 L92 28 L80 42 L72 36 L72 112 L28 112 L28 36 L20 42 L8 28 Z";
const TEE_HUNG = "M33 10 L45 6 Q50 15 55 6 L67 10 L78 18 L80 50 L72 50 L72 112 L28 112 L28 50 L20 50 L22 18 Z";
const TANK = "M36 6 L42 6 Q50 24 58 6 L64 6 Q66 24 74 30 L74 112 L26 112 L26 30 Q34 24 36 6 Z";
const KNIT_BODY = "M32 10 L45 6 Q50 15 55 6 L68 10 L84 22 L96 100 L84 102 L72 40 L72 112 L28 112 L28 40 L16 102 L4 100 L16 22 Z";
const KNIT_HUNG = "M34 10 L45 6 Q50 15 55 6 L66 10 L80 20 L84 104 L74 104 L72 40 L72 112 L28 112 L28 40 L26 104 L16 104 L20 20 Z";
const COAT_BODY = "M30 8 L44 4 L50 20 L56 4 L70 8 L90 26 L94 104 L80 104 L76 44 L76 114 L24 114 L24 44 L20 104 L6 104 L10 26 Z";
const COAT_HUNG = "M32 8 L44 4 L50 20 L56 4 L68 8 L82 20 L86 106 L76 106 L76 44 L76 114 L24 114 L24 44 L24 106 L14 106 L18 20 Z";
const PANTS = "M28 8 L72 8 L80 112 L58 112 L50 40 L42 112 L20 112 Z";
const SHORTS = "M24 20 L76 20 L84 82 L57 86 L50 54 L43 86 L16 82 Z";
const SKIRT = "M32 12 L68 12 L86 104 Q50 112 14 104 Z";
const DRESS = "M38 6 L44 6 Q50 15 56 6 L62 6 L64 30 L58 40 L88 112 Q50 118 12 112 L42 40 L36 30 Z";
const BAG = `M18 44 L82 44 L88 110 L12 110 Z M36 44 Q36 20 50 20 Q64 20 64 44 L58 44 Q58 28 50 28 Q42 28 42 44 Z`;
const HAT = "M20 74 Q20 34 52 34 Q84 34 84 74 L96 74 Q98 86 84 86 L18 86 Q14 80 20 74 Z";
const SHOE = "M8 72 Q8 66 14 66 Q26 64 30 54 L50 54 L62 68 L86 76 Q96 80 94 92 L94 98 L8 98 Z";
const SCARF = "M14 14 L36 8 L88 96 L88 112 L68 112 L16 30 Z";

const TOP_DETAILS = "M44 7 Q50 18 56 7";

export const DRAWINGS: Record<Shape, Record<View, Drawing>> = {
  tee: {
    flat: { body: TEE_BODY, details: `${TOP_DETAILS} M24 39 L13 28 M76 39 L87 28 M30 106 H70` },
    hung: { body: TEE_HUNG, details: `${TOP_DETAILS} M21 45 H29 M71 45 H79 M30 106 H70` },
    "folded-top": fromAbove(18, 14, 64, 92, "M38 14 Q50 32 62 14 M32 14 V100 M68 14 V100"),
    "folded-front": stack(80, "M42 42 Q50 52 58 42"),
  },
  tank: {
    flat: { body: TANK, details: "M42 8 Q50 26 58 8 M28 106 H72" },
    hung: { body: TANK, details: "M42 8 Q50 26 58 8 M28 106 H72 M30 30 Q34 26 36 10 M70 30 Q66 26 64 10" },
    "folded-top": fromAbove(22, 14, 56, 92, "M38 14 Q50 34 62 14 M32 14 Q32 24 22 26 M68 14 Q68 24 78 26"),
    "folded-front": stack(72, "M40 42 Q50 54 60 42"),
  },
  knit: {
    flat: { body: KNIT_BODY, details: `${TOP_DETAILS} M5 94 L17 96 M95 94 L83 96 M28 104 H72 M28 108 H72` },
    hung: { body: KNIT_HUNG, details: `${TOP_DETAILS} M17 98 H26 M74 98 H83 M28 104 H72 M28 108 H72` },
    "folded-top": fromAbove(16, 12, 68, 96, "M38 12 Q50 30 62 12 M30 12 V100 M70 12 V100 M16 96 H84"),
    "folded-front": stack(84, "M42 42 Q50 52 58 42 M24 48 V60 M30 48 V60 M70 48 V60 M76 48 V60"),
  },
  outerwear: {
    flat: { body: COAT_BODY, details: "M44 4 L50 20 L56 4 M50 20 V114 M30 82 H42 M58 82 H70" },
    hung: { body: COAT_HUNG, details: "M44 4 L50 20 L56 4 M50 20 V114 M30 82 H42 M58 82 H70" },
    "folded-top": fromAbove(14, 12, 72, 96, "M40 12 L50 30 L60 12 M50 30 V104 M28 12 V100 M72 12 V100 M32 76 H44 M56 76 H68"),
    "folded-front": stack(86, "M40 42 L50 54 L60 42 M50 54 V64"),
  },
  pants: {
    flat: { body: PANTS, details: "M28 18 H72 M50 18 V36 M32 18 Q36 28 29 30 M68 18 Q64 28 71 30" },
    hung: { body: PANTS, details: "M28 18 H72 M50 18 V36 M36 40 L32 108 M64 40 L68 108" },
    "folded-top": fromAbove(22, 10, 56, 100, "M22 24 H78 M50 24 V44 M22 66 H78 M30 24 Q34 34 26 38"),
    "folded-front": stack(70, "M18 50 H82"),
  },
  shorts: {
    flat: { body: SHORTS, details: "M24 30 H76 M50 30 V48 M18 76 L42 80 M82 76 L58 80" },
    hung: { body: SHORTS, details: "M24 30 H76 M50 30 V48 M18 76 L42 80 M82 76 L58 80" },
    "folded-top": fromAbove(22, 24, 56, 72, "M22 38 H78 M50 38 V56 M30 38 Q34 48 26 52"),
    "folded-front": stack(70, "M18 50 H82 M50 50 V64"),
  },
  skirt: {
    flat: { body: SKIRT, details: "M31 20 H69 M42 20 L36 104 M58 20 L64 104 M50 20 V108" },
    hung: { body: SKIRT, details: "M31 20 H69 M42 20 L36 104 M58 20 L64 104 M50 20 V108" },
    "folded-top": fromAbove(20, 18, 60, 84, "M20 30 H80 M36 30 V96 M50 30 V96 M64 30 V96"),
    "folded-front": stack(70, "M18 50 H82"),
  },
  dress: {
    flat: { body: DRESS, details: "M44 7 Q50 18 56 7 M42 40 H58 M46 40 L38 112 M54 40 L62 112" },
    hung: { body: DRESS, details: "M44 7 Q50 18 56 7 M42 40 H58 M46 40 L38 112 M54 40 L62 112" },
    "folded-top": fromAbove(20, 12, 60, 96, "M40 12 Q50 28 60 12 M20 50 H80 M34 12 V100 M66 12 V100"),
    "folded-front": stack(76, "M42 42 Q50 52 58 42"),
  },
  bag: {
    flat: { body: BAG, details: "M16 62 H84 M44 62 V70 H56 V62" },
    hung: { body: `M40 6 L60 6 L66 44 L84 44 L88 112 L12 112 L16 44 L34 44 Z M44 12 L40 44 L60 44 L56 12 Z`, details: "M15 62 H85 M44 62 V70 H56 V62" },
    "folded-top": { body: `${box(14, 42, 72, 48, 8)} M32 42 Q32 18 50 18 Q68 18 68 42 L62 42 Q62 26 50 26 Q38 26 38 42 Z`, details: "M18 54 H82 M50 42 V90" },
    "folded-front": { body: "M22 62 L78 62 L84 112 L16 112 Z M38 62 Q38 44 50 44 Q62 44 62 62 L57 62 Q57 50 50 50 Q43 50 43 62 Z", details: `M19 78 H81 ${SHELF}` },
  },
  hat: {
    flat: { body: HAT, details: "M20 66 H84 M52 34 V66" },
    hung: { body: HAT, details: "M20 66 H84 M52 34 V66" },
    "folded-top": { body: oval(50, 62, 42, 40), details: `${oval(50, 58, 24, 24)} M50 34 V82` },
    "folded-front": { body: "M22 96 Q22 60 52 60 Q80 60 80 96 L92 96 Q94 106 80 106 L20 106 Q16 102 22 96 Z", details: `M22 90 H80 M51 60 V90 ${SHELF}` },
  },
  shoes: {
    flat: { body: SHOE, details: "M8 90 H94 M36 58 L42 64 M42 56 L48 62 M48 58 L54 64" },
    hung: { body: SHOE, details: "M8 90 H94 M36 58 L42 64 M42 56 L48 62 M48 58 L54 64" },
    "folded-top": { body: `${oval(30, 62, 15, 46)} ${oval(70, 62, 15, 46)}`, details: `${oval(30, 50, 7, 18)} ${oval(70, 50, 7, 18)}` },
    "folded-front": { body: "M6 94 Q6 88 12 88 Q20 86 23 78 L34 78 L40 88 L46 90 Q50 92 50 100 L50 108 L6 108 Z M52 94 Q52 88 58 88 Q66 86 69 78 L80 78 L86 88 L92 90 Q96 92 96 100 L96 108 L52 108 Z", details: `M6 103 H50 M52 103 H96 ${SHELF}` },
  },
  scarf: {
    flat: { body: SCARF, details: "M72 112 V118 M78 112 V118 M84 112 V118 M26 24 L76 104" },
    hung: { body: "M36 8 L64 8 L64 108 L36 108 Z", details: "M36 20 H64 M40 108 V116 M46 108 V116 M52 108 V116 M58 108 V116" },
    "folded-top": fromAbove(20, 20, 60, 80, "M20 40 H80 M20 60 H80 M20 80 H80"),
    "folded-front": { body: `${oval(34, 92, 18, 18)} ${oval(66, 92, 18, 18)}`, details: `${oval(34, 92, 8, 8)} ${oval(66, 92, 8, 8)} ${SHELF}` },
  },
};

// ---------------------------------------------------------------- which shape

// A product's own name settles the shapes a category can't: a cap sits in
// "Accessories" beside bags (P3.7). "Cap sleeve" is a top, not a cap; "short"
// is shorts, never "short-sleeve".
const NOT_SLEEVE = String.raw`(?![\s\-–]*sleeve)`;
const NAME_KEYWORDS: [RegExp, Shape][] = [
  [new RegExp(String.raw`\b(cap|hat|beanie|beret|bucket hat)s?\b${NOT_SLEEVE}`, "i"), "hat"],
  [/\b(shoes?|sneakers?|boots?|sandals?|loafers?|heels?)\b/i, "shoes"],
  [/\b(scarf|scarves|belts?)\b/i, "scarf"],
  [/\b(tank|cami|camisole)s?\b/i, "tank"],
  [/\bskirts?\b/i, "skirt"],
  [new RegExp(String.raw`\bshorts?\b${NOT_SLEEVE}|boardshorts?`, "i"), "shorts"],
  [/\b(bag|tote|backpack|clutch|crossbody)s?\b/i, "bag"],
  // A denim jacket sits in "Denim" beside the jeans.
  [/\b(jacket|coat|blazer|parka|puffer)s?\b/i, "outerwear"],
];

const CATEGORY_KEYWORDS: [RegExp, Shape][] = [
  [new RegExp(String.raw`\b(hats?|caps?|beanies?)\b${NOT_SLEEVE}`, "i"), "hat"],
  [/shoe|sneaker|boot|sandal|footwear/i, "shoes"],
  [/scarf|scarves|belt/i, "scarf"],
  [/\btanks?\b|cami/i, "tank"],
  [/knit|sweater|cardigan|long.?sleeve/i, "knit"],
  [new RegExp(String.raw`shorts?\b${NOT_SLEEVE}`, "i"), "shorts"],
  [/skirt/i, "skirt"],
  [/denim|jean|pant|trouser|legging/i, "pants"],
  [/dress/i, "dress"],
  [/outer|coat|jacket|blazer/i, "outerwear"],
  [/accessor|bag|tote|jewel/i, "bag"],
];

export function drawingFor(categoryName: string, productName = ""): Shape {
  return (
    NAME_KEYWORDS.find(([pattern]) => pattern.test(productName))?.[1] ??
    CATEGORY_KEYWORDS.find(([pattern]) => pattern.test(categoryName))?.[1] ??
    "tee"
  );
}

/** Which view a planogram tile draws (spec §4.2): hung as it hangs; folded from above on a table top, else from the front. */
export function viewFor(presentation: Presentation, side: string): View {
  if (presentation === "hung") return "hung";
  return side === "top" ? "folded-top" : "folded-front";
}
