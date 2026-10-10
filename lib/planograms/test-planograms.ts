// Map pieces and products for planogram DB tests, written as the owner (like
// lib/products/test-stores.ts): setting up is not what the tests check.

import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { fixtureFaces, fixtures, planograms, products, tableSets } from "@/db/schema";
import type { FaceSide, FixtureType, Side } from "@/lib/layout/types";

type FaceOption = { side: FaceSide; columns: number; rows: number };
export type FixtureOptions = {
  name?: string;
  type?: FixtureType;
  faces?: FaceOption[];
  tableSetId?: string | null;
  setSide?: Side | null;
};

export async function addFixture(
  storeId: string,
  { name = "4-way Rack 2", type = "rack", faces = [{ side: "front", columns: 6, rows: 4 }], tableSetId = null, setSide = null }: FixtureOptions = {},
): Promise<{ fixtureId: string; faceIds: Partial<Record<FaceSide, string>> }> {
  const fixtureId = randomUUID();
  await db.insert(fixtures).values({ id: fixtureId, storeId, type, name, x: 200, y: 200, width: 72, depth: 36, tableSetId, setSide });
  const faceIds: Partial<Record<FaceSide, string>> = {};
  for (const face of faces) {
    const id = randomUUID();
    await db.insert(fixtureFaces).values({ id, storeId, fixtureId, ...face });
    faceIds[face.side] = id;
  }
  return { fixtureId, faceIds };
}

/** "Front Table set": an upper table (top 6×3) with a front lower table (top 6×2). */
export async function addTableSet(storeId: string): Promise<{ upperId: string; upperFaceId: string; frontId: string; frontFaceId: string }> {
  const upper = await addFixture(storeId, { name: "Front Table set", type: "table", faces: [{ side: "top", columns: 6, rows: 3 }] });
  const setId = randomUUID();
  await db.insert(tableSets).values({ id: setId, storeId, upperFixtureId: upper.fixtureId });
  const front = await addFixture(storeId, { name: "", type: "table", faces: [{ side: "top", columns: 6, rows: 2 }], tableSetId: setId, setSide: "front" });
  return { upperId: upper.fixtureId, upperFaceId: upper.faceIds.top ?? "", frontId: front.fixtureId, frontFaceId: front.faceIds.top ?? "" };
}

export async function addProduct(storeId: string, categoryId: string, name: string): Promise<string> {
  const [row] = await db
    .insert(products)
    .values({ storeId, name, styleNumber: `T-${randomUUID().slice(0, 8)}`, categoryId, color: "Black" })
    .returning({ id: products.id });
  return row.id;
}

export async function rawPlanogram(storeId: string, fixtureId: string): Promise<string> {
  const id = randomUUID();
  await db.insert(planograms).values({ id, storeId, fixtureId, hasDraft: true });
  return id;
}
