// Small builders for tests. Not imported by app code.

import { EMPTY_LAYOUT, type Entrance, type Face, type Fixture, type Layout, type Point, type Zone } from "./types";

export function rectangle(x: number, y: number, width: number, depth: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth },
  ];
}

/** An empty store, 40 ft × 30 ft by default, already saved once. */
export function store(width = 480, depth = 360): Layout {
  return { ...EMPTY_LAYOUT, outline: { points: rectangle(0, 0, width, depth), version: 1 } };
}

export function zone(over: Partial<Zone> = {}): Zone {
  return {
    id: "zone-a",
    name: "Front tables",
    type: "display",
    color: "zone-1",
    points: rectangle(0, 0, 240, 180),
    version: 1,
    ...over,
  };
}

export function fixture(over: Partial<Fixture> = {}): Fixture {
  return {
    id: "fixture-a",
    zoneId: null,
    type: "table",
    name: "Table 1",
    x: 300,
    y: 100,
    width: 72,
    depth: 36,
    rotation: 0,
    tableSetId: null,
    setSide: null,
    version: 1,
    ...over,
  };
}

export function face(over: Partial<Face> = {}): Face {
  return { id: "face-a", fixtureId: "fixture-a", side: "top", columns: 6, rows: 3, version: 1, ...over };
}

export function entrance(over: Partial<Entrance> = {}): Entrance {
  return { id: "entrance-a", x: 240, y: 360, width: 72, version: 1, ...over };
}
