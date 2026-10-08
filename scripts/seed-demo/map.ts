// The demo store's floor (spec §6.3): about 60 × 40 ft, in store inches like
// every map (Week 3 spec §4). Built from the editor's own rules, then checked
// by the editor's own validator in map.test.ts.

import { FIXTURE_RULES, gridForSurface, lowerTableLength, lowerTablePose } from "@/lib/layout/fixtures";
import { rectanglePoints } from "@/lib/layout/factories";
import { DEFAULT_LOWER_DEPTH } from "@/lib/layout/limits";
import { lowerTableName, normalize } from "@/lib/layout/normalize";
import type { Face, FaceSide, Fixture, FixtureType, Layout, Side, Zone, ZoneColor, ZoneType } from "@/lib/layout/types";

export type FaceKind = "wall" | "rack" | "table";
export type DemoMap = { layout: Layout; stockroomZoneId: string; faceKinds: Map<string, FaceKind> };

export function demoMap(newId: () => string): DemoMap {
  const zones: Zone[] = [];
  const fixtures: Fixture[] = [];
  const faces: Face[] = [];
  const faceKinds = new Map<string, FaceKind>();

  const zone = (name: string, type: ZoneType, color: ZoneColor, x: number, y: number, w: number, d: number) => {
    const z: Zone = { id: newId(), name, type, color, points: rectanglePoints(w, d, { x, y }), version: 0 };
    zones.push(z);
    return z;
  };
  const fixture = (type: FixtureType, name: string, x: number, y: number, size?: { width: number; depth: number }) => {
    const rule = FIXTURE_RULES[type];
    const f: Fixture = {
      id: newId(), zoneId: null, type, name, x, y,
      width: size?.width ?? rule.width, depth: size?.depth ?? rule.depth,
      rotation: 0, tableSetId: null, setSide: null, version: 0,
    };
    fixtures.push(f);
    return f;
  };
  const face = (f: Fixture, side: FaceSide, columns: number, rows: number, kind: FaceKind) => {
    const id = newId();
    faces.push({ id, fixtureId: f.id, side, columns, rows, version: 0 });
    faceKinds.set(id, kind);
  };

  const stockroom = zone("Stockroom", "stockroom", "zone-7", 0, 0, 90, 100);
  zone("Back wall", "display", "zone-2", 96, 0, 528, 60);
  zone("Racks, left", "display", "zone-3", 60, 110, 230, 160);
  zone("Racks, right", "display", "zone-4", 430, 110, 230, 160);
  zone("Front tables", "display", "zone-1", 90, 320, 530, 130);
  zone("Fitting rooms", "fitting_room", "zone-5", 640, 300, 80, 180);
  zone("Cash wrap", "cash_wrap", "zone-6", 0, 300, 80, 180);

  // Back wall: eight bays facing into the store, two inches apart.
  for (let i = 0; i < 8; i++) face(fixture("wall_bay", `Wall bay ${i + 1}`, 150 + i * 50, 14), "front", 4, 5, "wall");

  // Double-sided racks, four a side. Four rows so a 1 × 4 hung footprint fits.
  const rackSpots = [[120, 160], [230, 160], [120, 230], [230, 230], [490, 160], [600, 160], [490, 230], [600, 230]];
  rackSpots.forEach(([x, y], i) => {
    const rack = fixture("rack", `Rack ${i + 1}`, x, y);
    face(rack, "front", 4, 4, "rack");
    face(rack, "back", 4, 4, "rack");
  });

  // Front tables: one set (an upper with lower tables left and right) between two singles.
  const tableTop = (t: Fixture) => {
    const grid = gridForSurface(t.width, t.depth);
    face(t, "top", grid.columns, grid.rows, "table");
  };
  tableTop(fixture("table", "Front table 2", 180, 385));
  const upper = fixture("table", "Front table 1", 360, 385);
  tableTop(upper);
  tableTop(fixture("table", "Front table 3", 540, 385));
  const setId = newId();
  for (const side of ["left", "right"] as Side[]) {
    const width = lowerTableLength(upper, side);
    const pose = lowerTablePose(upper, side, DEFAULT_LOWER_DEPTH);
    const lower: Fixture = {
      id: newId(), zoneId: null, type: "table", name: lowerTableName(upper.name, side),
      x: Math.round(pose.x), y: Math.round(pose.y), width, depth: DEFAULT_LOWER_DEPTH, rotation: pose.rotation,
      tableSetId: setId, setSide: side, version: 0,
    };
    fixtures.push(lower);
    tableTop(lower);
  }

  fixture("mannequin", "Mannequin 1", 260, 340);
  fixture("mannequin", "Mannequin 2", 460, 340);
  fixture("prop", "Cash wrap counter", 40, 390, { width: 48, depth: 48 });

  const layout = normalize({
    outline: { points: rectanglePoints(720, 480), version: 0 },
    entrances: [{ id: newId(), x: 360, y: 480, width: 96, version: 0 }],
    zones,
    fixtures,
    faces,
    tableSets: [{ id: setId, upperFixtureId: upper.id, version: 0 }],
  });
  return { layout, stockroomZoneId: stockroom.id, faceKinds };
}
