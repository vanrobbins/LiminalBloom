// The store map's data, in store inches (spec §4–5). Types and constants
// only: the editor, the validator and the server all import from here.

export type Point = { x: number; y: number };

export const ZONE_TYPES = ["display", "fitting_room", "cash_wrap", "stockroom", "other"] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export const ZONE_COLORS = [
  "zone-1",
  "zone-2",
  "zone-3",
  "zone-4",
  "zone-5",
  "zone-6",
  "zone-7",
  "zone-8",
] as const;
export type ZoneColor = (typeof ZONE_COLORS)[number];

export const FIXTURE_TYPES = ["table", "wall_bay", "rack", "mannequin", "platform", "prop"] as const;
export type FixtureType = (typeof FIXTURE_TYPES)[number];

export const SIDES = ["front", "back", "left", "right"] as const;
export type Side = (typeof SIDES)[number];

export const FACE_SIDES = ["front", "back", "left", "right", "top"] as const;
export type FaceSide = (typeof FACE_SIDES)[number];

// `version` is the database's row version; 0 means "never saved".

export type Outline = { points: Point[]; version: number };

export type Entrance = { id: string; x: number; y: number; width: number; version: number };

export type Zone = {
  id: string;
  name: string;
  type: ZoneType;
  color: ZoneColor;
  points: Point[];
  version: number;
};

export type Fixture = {
  id: string;
  /** Derived by normalize(), never set directly: the zone holding the centre. */
  zoneId: string | null;
  type: FixtureType;
  name: string;
  /** Centre. */
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Whole degrees, clockwise; at 0 the front faces +y. */
  rotation: number;
  /** Set only on lower tables. */
  tableSetId: string | null;
  setSide: Side | null;
  version: number;
};

export type Face = {
  id: string;
  fixtureId: string;
  side: FaceSide;
  columns: number;
  rows: number;
  version: number;
};

export type TableSet = { id: string; upperFixtureId: string; version: number };

export type Layout = {
  outline: Outline | null;
  entrances: Entrance[];
  zones: Zone[];
  fixtures: Fixture[];
  faces: Face[];
  tableSets: TableSet[];
};

export const EMPTY_LAYOUT: Layout = {
  outline: null,
  entrances: [],
  zones: [],
  fixtures: [],
  faces: [],
  tableSets: [],
};

/** The outline has no id of its own; this stands in for it in selections and issues. */
export const OUTLINE_ID = "outline";

export type IssueKind =
  | "corners"
  | "crosses-itself"
  | "short-edge"
  | "too-small"
  | "out-of-bounds"
  | "outside-store"
  | "overlap"
  | "name"
  | "duplicate-name"
  | "faces"
  | "grid"
  | "size"
  | "off-wall"
  | "table-set";

/** A problem with one item. `blockerId` names the other item when two clash. */
export type Issue = { itemId: string; kind: IssueKind; message: string; blockerId?: string };
