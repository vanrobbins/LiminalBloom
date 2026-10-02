// A store's whole map, read in one scoped batch (spec §8). The store id comes
// from requireMember(); RLS hides every other store's rows even so, and the
// explicit filters keep the queries correct without relying on it.

import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { entrances, fixtureFaces, fixtures, storeLayouts, tableSets, zones } from "@/db/schema";
import { withStore } from "@/lib/db/with-store";

import type { Layout } from "./types";

export async function loadLayout(storeId: string): Promise<Layout> {
  const [outlineRows, entranceRows, zoneRows, fixtureRows, faceRows, setRows] = await withStore(storeId, [
    db.select().from(storeLayouts).where(eq(storeLayouts.storeId, storeId)),
    db.select().from(entrances).where(eq(entrances.storeId, storeId)).orderBy(asc(entrances.createdAt), asc(entrances.id)),
    db.select().from(zones).where(eq(zones.storeId, storeId)).orderBy(asc(zones.createdAt), asc(zones.id)),
    db.select().from(fixtures).where(eq(fixtures.storeId, storeId)).orderBy(asc(fixtures.createdAt), asc(fixtures.id)),
    db.select().from(fixtureFaces).where(eq(fixtureFaces.storeId, storeId)).orderBy(asc(fixtureFaces.createdAt), asc(fixtureFaces.id)),
    db.select().from(tableSets).where(eq(tableSets.storeId, storeId)),
  ] as const);

  const outline = outlineRows[0];
  return {
    outline: outline ? { points: outline.outline, version: outline.version } : null,
    entrances: entranceRows.map(({ id, x, y, width, version }) => ({ id, x, y, width, version })),
    zones: zoneRows.map(({ id, name, type, color, points, version }) => ({ id, name, type, color, points, version })),
    fixtures: fixtureRows.map(({ id, zoneId, type, name, x, y, width, depth, rotation, tableSetId, setSide, version }) => ({
      id,
      zoneId,
      type,
      name,
      x,
      y,
      width,
      depth,
      rotation,
      tableSetId,
      setSide,
      version,
    })),
    faces: faceRows.map(({ id, fixtureId, side, columns, rows, version }) => ({ id, fixtureId, side, columns, rows, version })),
    tableSets: setRows.map(({ id, upperFixtureId, version }) => ({ id, upperFixtureId, version })),
  };
}
