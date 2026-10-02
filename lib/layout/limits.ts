// Every bound and interaction number the map uses, in one place, so the
// editor, the validator, the Zod schema and the server can never disagree
// (docs/superpowers/specs/2026-09-30-store-map-design.md §5–7). Lengths are
// whole inches.

/** The drawing area: 1,000 ft square. */
export const MAX_COORD = 12_000;
export const MAX_CORNERS = 64;

export const MIN_OUTLINE_EDGE = 12;
export const MIN_ZONE_EDGE = 6;
/** 4 sq ft. */
export const MIN_ZONE_AREA = 576;

export const MIN_FIXTURE_SIZE = 12;
export const MAX_FIXTURE_SIZE = 600;

export const MIN_ENTRANCE_WIDTH = 36;
export const MAX_ENTRANCE_WIDTH = 240;
export const DEFAULT_ENTRANCE_WIDTH = 72;

/** How far a new lower table reaches out from its upper table. */
export const DEFAULT_LOWER_DEPTH = 24;

export const MAX_GRID = 24;
export const MAX_NAME = 60;
export const MAX_CHANGES_PER_SAVE = 500;

/** The grid that free movement snaps to. */
export const GRID_STEP = 6;
/** Snapping reaches this far on screen, so it feels the same at every zoom. */
export const SNAP_PX = 12;
export const ROTATION_STEP = 15;

/**
 * Rotated corners are not whole numbers. Shapes closer than this are
 * touching, not overlapping. The one tolerance for rotated shapes (spec §4).
 */
export const ROTATED_EPSILON = 1 / 64;

/** First-time setup: a store is 10 ft to 1,000 ft on each side. */
export const MIN_STORE_SIDE = 120;
export const MAX_STORE_SIDE = 12_000;
