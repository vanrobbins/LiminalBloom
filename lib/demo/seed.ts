// The demo store, "Pioneer Place": four fixtures, nineteen products, and a
// published planogram on each fixture. Set up so the core loop has somewhere
// to go: the Straight jean can sell out and the Wide-leg jean fits its space;
// the Crew sock is already sold out on the Front table; the Mid-rise jean is
// new and has no place yet.

import type { DemoState, Fixture, Placement, Product, Zone } from "./types";

export const ZONES: Zone[] = [
  { id: "denim", name: "Denim", tone: 2, points: "8,8 120,8 120,132 8,132", label: { x: 30, y: 24 } },
  { id: "knits", name: "Knits", tone: 5, points: "136,8 292,8 292,118 136,118", label: { x: 146, y: 24 } },
  { id: "front", name: "Front tables", tone: 4, points: "104,146 232,146 232,226 104,226", label: { x: 112, y: 162 } },
  { id: "window", name: "Window", tone: 6, points: "8,146 92,146 92,226 8,226", label: { x: 30, y: 162 } },
];

const SHELVES = ["Top shelf", "Middle shelf", "Bottom shelf"];
const RAILS = ["Top rail", "Bottom rail"];

export const FIXTURES: Fixture[] = [
  {
    id: "denim-wall",
    name: "Denim wall",
    kind: "wall",
    zoneId: "denim",
    faces: [{ id: "front", label: "Front", cols: 16, rows: 3, rowWords: SHELVES }],
    map: { x: 12, y: 32, w: 12, h: 92 },
    due: "Nov 14",
  },
  {
    id: "fitting-rack",
    name: "Fitting room rack",
    kind: "rack",
    zoneId: "knits",
    faces: [
      { id: "front", label: "Front", cols: 12, rows: 2, rowWords: RAILS },
      { id: "back", label: "Back", cols: 12, rows: 2, rowWords: RAILS },
    ],
    map: { x: 172, y: 56, w: 92, h: 14 },
    due: "Nov 20",
  },
  {
    id: "front-table",
    name: "Front table",
    kind: "table",
    zoneId: "front",
    faces: [{ id: "top", label: "Top", cols: 10, rows: 4, rowWords: ["Back", "Middle back", "Middle front", "Front edge"] }],
    map: { x: 136, y: 174, w: 64, h: 36 },
    due: "Tomorrow",
  },
  {
    id: "window-wall",
    name: "Window wall",
    kind: "wall",
    zoneId: "window",
    faces: [{ id: "front", label: "Front", cols: 12, rows: 3, rowWords: SHELVES }],
    map: { x: 12, y: 170, w: 12, h: 50 },
    due: "Dec 1",
  },
];

function product(
  id: string,
  name: string,
  style: string,
  category: string,
  colour: string,
  tone: number,
  hung: [number, number],
  folded: [number, number],
  status: Product["status"] = "in_stock",
): Product {
  return { id, name, style, category, colour, tone, status, hung: { w: hung[0], h: hung[1] }, folded: { w: folded[0], h: folded[1] } };
}

export const PRODUCTS: Product[] = [
  product("straight", "Straight jean", "SJ-01", "Denim", "Indigo", 2, [3, 1], [4, 1]),
  product("relaxed", "Relaxed jean", "RJ-02", "Denim", "Mid wash", 2, [3, 1], [4, 1]),
  product("skinny", "Skinny jean", "KJ-03", "Denim", "Black", 5, [3, 1], [4, 1]),
  product("wide-leg", "Wide-leg jean", "WJ-04", "Denim", "Indigo", 2, [3, 1], [4, 1]),
  product("mid-rise", "Mid-rise jean", "MJ-05", "Denim", "Light wash", 6, [3, 1], [3, 1]),
  product("hr-pant", "High-rise pant", "HRP-01", "Pants", "Sage", 1, [3, 1], [3, 1]),
  product("hr-short", "High-rise short", "HRS-04", "Pants", "Sand", 4, [2, 1], [3, 1], "on_sale"),
  product("linen-tee", "Linen tee", "LT-01", "Knits", "Oat", 4, [3, 1], [2, 1]),
  product("sweater", "Cable sweater", "CS-02", "Knits", "Rust", 3, [3, 1], [3, 1]),
  product("cardigan", "Merino cardigan", "MC-03", "Knits", "Ecru", 4, [3, 1], [3, 1]),
  product("pocket-tee", "Pocket tee", "PT-04", "Knits", "Navy", 2, [2, 1], [2, 1]),
  product("polo", "Pique polo", "PP-05", "Knits", "Sage", 1, [3, 1], [2, 1]),
  product("midi", "Linen midi dress", "LD-01", "Dresses", "Rust", 3, [2, 1], [3, 1]),
  product("slip", "Slip dress", "SD-02", "Dresses", "Black", 5, [2, 1], [3, 1]),
  product("jacket", "Cropped denim jacket", "DJ-01", "Outerwear", "Mid wash", 2, [3, 1], [3, 1], "on_sale"),
  product("crew-sock", "Crew sock", "CS-10", "Accessories", "White", 7, [1, 1], [2, 1], "sold_out"),
  product("ankle-sock", "Ankle sock", "AS-13", "Accessories", "Grey", 7, [1, 1], [2, 1]),
  product("cap", "Baseball cap", "BC-11", "Accessories", "Navy", 2, [1, 1], [2, 1]),
  product("tote", "Canvas tote", "CT-12", "Accessories", "Natural", 4, [2, 1], [2, 1]),
];

function at(id: string, productId: string, fixtureId: string, faceId: string, col: number, row: number, w: number, presentation: Placement["presentation"]): Placement {
  return { id, productId, fixtureId, faceId, col, row, w, h: 1, presentation };
}

const PUBLISHED: Placement[] = [
  at("pl-1", "hr-pant", "denim-wall", "front", 2, 1, 3, "folded"),
  at("pl-2", "relaxed", "denim-wall", "front", 6, 1, 4, "folded"),
  at("pl-3", "straight", "denim-wall", "front", 4, 2, 4, "folded"),
  at("pl-4", "skinny", "denim-wall", "front", 10, 2, 4, "folded"),
  at("pl-5", "linen-tee", "fitting-rack", "front", 0, 0, 3, "hung"),
  at("pl-6", "sweater", "fitting-rack", "front", 3, 0, 3, "hung"),
  at("pl-7", "midi", "fitting-rack", "front", 7, 0, 2, "hung"),
  at("pl-8", "slip", "fitting-rack", "front", 9, 0, 2, "hung"),
  at("pl-9", "jacket", "fitting-rack", "front", 0, 1, 3, "hung"),
  at("pl-10", "cardigan", "fitting-rack", "back", 0, 0, 3, "hung"),
  at("pl-11", "pocket-tee", "front-table", "top", 0, 0, 2, "folded"),
  at("pl-12", "hr-short", "front-table", "top", 3, 1, 3, "folded"),
  at("pl-13", "crew-sock", "front-table", "top", 6, 2, 2, "folded"),
  at("pl-14", "cap", "window-wall", "front", 0, 0, 2, "folded"),
  at("pl-15", "tote", "window-wall", "front", 3, 1, 2, "folded"),
];

export function seedState(): DemoState {
  return {
    role: "vm-lead",
    products: PRODUCTS.map((p) => ({ ...p })),
    published: PUBLISHED.map((p) => ({ ...p })),
    drafts: {},
    undo: {},
    versions: { "denim-wall": 4, "fitting-rack": 3, "front-table": 6, "window-wall": 2 },
    nextId: 100,
  };
}
