// The demo store behind the interactive prototype (branch
// feature/prototype-walkthrough). Made-up data held in browser memory:
// no database, nothing saved. Columns are half feet; rows are shelves or rails.

export type Status = "in_stock" | "sold_out" | "on_sale";
export type Presentation = "hung" | "folded";
export type Role = "vm-lead" | "associate";

export type Size = { w: number; h: number };

export type Product = {
  id: string;
  name: string;
  style: string;
  category: string;
  colour: string;
  /** A zone colour, 1–8, used as the product's tint on tiles and cards. */
  tone: number;
  status: Status;
  hung: Size;
  folded: Size;
};

export type Face = {
  id: string;
  label: string;
  cols: number;
  rows: number;
  /** What each row is called, top (or back) first: "Top shelf", "Top rail". */
  rowWords: string[];
};

export type FixtureKind = "wall" | "rack" | "table";

export type Fixture = {
  id: string;
  name: string;
  kind: FixtureKind;
  zoneId: string;
  faces: Face[];
  /** Where it sits on the map, in map units. */
  map: { x: number; y: number; w: number; h: number };
  due: string;
};

export type Zone = {
  id: string;
  name: string;
  tone: number;
  points: string;
  label: { x: number; y: number };
};

export type Placement = {
  id: string;
  productId: string;
  fixtureId: string;
  faceId: string;
  col: number;
  row: number;
  w: number;
  h: number;
  presentation: Presentation;
  /** Set by Quick Adjust: this spot differs from the monthly planogram. */
  adjusted?: boolean;
};

export type DemoState = {
  role: Role;
  products: Product[];
  /** What everyone sees, and what search answers from. */
  published: Placement[];
  /** A fixture's work in progress; present only while it has changes. */
  drafts: Record<string, Placement[]>;
  /** Each fixture's earlier draft states, newest last, for Undo. */
  undo: Record<string, Placement[][]>;
  versions: Record<string, number>;
  nextId: number;
};
