// What a save may contain, checked on the server before anything else
// (CODESTYLE TypeScript rule 5, §8.4). Shape and bounds only; the layout
// rules themselves are validate()'s job, after the change is applied.

import { z } from "zod";

import { changeCount, type ChangeSet } from "./diff";
import { MAX_CHANGES_PER_SAVE, MAX_COORD, MAX_CORNERS, MAX_NAME } from "./limits";
import { FACE_SIDES, FIXTURE_TYPES, SIDES, ZONE_COLORS, ZONE_TYPES } from "./types";

const whole = (min: number, max: number) => z.number().int().min(min).max(max);
const coord = whole(0, MAX_COORD);
const point = z.object({ x: coord, y: coord });
const polygon = z.array(point).min(3).max(MAX_CORNERS);
const id = z.uuid();
const version = whole(0, 2_147_483_647);
const name = z.string().trim().min(1).max(MAX_NAME);

const outline = z.object({ points: polygon, version });
const entrance = z.object({ id, x: coord, y: coord, width: whole(1, MAX_COORD), version });
const zone = z.object({ id, name, type: z.enum(ZONE_TYPES), color: z.enum(ZONE_COLORS), points: polygon, version });
const fixture = z.object({
  id,
  zoneId: id.nullable(),
  type: z.enum(FIXTURE_TYPES),
  name,
  x: coord,
  y: coord,
  width: whole(1, MAX_COORD),
  depth: whole(1, MAX_COORD),
  rotation: whole(0, 359),
  tableSetId: id.nullable(),
  setSide: z.enum(SIDES).nullable(),
  version,
});
const face = z.object({ id, fixtureId: id, side: z.enum(FACE_SIDES), columns: whole(1, 99), rows: whole(1, 99), version });
const tableSet = z.object({ id, upperFixtureId: id, version });

const upsert = <T extends z.ZodType>(item: T) => z.object({ item, expectedVersion: version.nullable() });
// Each list is capped so oversize input fails before anything else is checked.
const list = <T extends z.ZodType>(item: T) => z.array(item).max(MAX_CHANGES_PER_SAVE);

export const changeSetSchema = z
  .object({
    outline: upsert(outline).nullable(),
    entrances: list(upsert(entrance)),
    zones: list(upsert(zone)),
    fixtures: list(upsert(fixture)),
    faces: list(upsert(face)),
    tableSets: list(upsert(tableSet)),
    deletes: list(
      z.object({ collection: z.enum(["entrances", "zones", "fixtures", "faces", "tableSets"]), id, expectedVersion: version }),
    ),
  })
  .refine((changes) => changeCount(changes) <= MAX_CHANGES_PER_SAVE, "Too many changes in one save.");

export function parseChangeSet(input: unknown): ChangeSet | null {
  const result = changeSetSchema.safeParse(input);
  return result.success ? result.data : null;
}
