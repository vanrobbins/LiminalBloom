// Turns the catalog and the floor into rows (spec §6.3), and the rows into one
// batch that replaces the demo store's contents. Pure apart from the batch, so
// the tests check the whole store before anything is written.

import { createHash, randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import {
  entrances,
  fixtures,
  productCategories,
  productLocations,
  products,
  stockroomBins,
  storeLayouts,
  zones,
} from "@/db/schema";
import { diff } from "@/lib/layout/diff";
import { EMPTY_LAYOUT, type Layout } from "@/lib/layout/types";
import { writeStatements } from "@/lib/layout/write";
import { categoryFootprint, type Presentation } from "@/lib/products/footprint";
import { silhouetteFor, silhouetteSvg } from "@/lib/products/silhouettes";

import { DEMO_BIN_CODES, DEMO_CATEGORIES, DEMO_PRODUCTS } from "./catalog";
import { demoMap } from "./map";
import { pack, type FaceSlot, type PlaceRequest } from "./packer";

export type DemoPlan = {
  layout: Layout;
  bins: (typeof stockroomBins.$inferInsert)[];
  categories: (typeof productCategories.$inferInsert)[];
  products: (typeof products.$inferInsert & { id: string; imagePath: string })[];
  locations: (typeof productLocations.$inferInsert & { id: string })[];
  /** Blob path → SVG. */
  images: Map<string, string>;
};

const ACCEPTS = { wall: ["hung", "folded"], rack: ["hung"], table: ["folded"] } as const;

export function buildDemo(storeId: string, newId: () => string = randomUUID): DemoPlan {
  const { layout, faceKinds, stockroomZoneId } = demoMap(newId);
  const bins = DEMO_BIN_CODES.map((code) => ({ id: newId(), storeId, code, zoneId: stockroomZoneId }));
  const categories = DEMO_CATEGORIES.map((c) => ({ id: newId(), storeId, ...c }));
  const categoryOf = new Map(categories.map((c) => [c.name, c]));
  const images = new Map<string, string>();

  const productRows = DEMO_PRODUCTS.map((p) => {
    const svg = silhouetteSvg(silhouetteFor(p.category), p.hex);
    const imagePath = `stores/${storeId}/products/seed-${createHash("sha256").update(svg).digest("hex").slice(0, 16)}.svg`;
    images.set(imagePath, svg);
    return {
      id: newId(), storeId, name: p.name, styleNumber: p.styleNumber, categoryId: categoryOf.get(p.category)!.id,
      color: p.color, sizeRange: p.sizeRange, status: p.status, imagePath,
    };
  });

  // Floor first, in catalog order; then bins round-robin.
  const requests: PlaceRequest[] = DEMO_PRODUCTS.flatMap((p, i) => {
    const wanted: Presentation[] = p.plan === "HF" ? ["hung", "folded"] : p.plan === "H" || p.plan === "HB" ? ["hung"] : p.plan === "F" ? ["folded"] : [];
    const category = categoryOf.get(p.category)!;
    return wanted.map((presentation) => ({ productId: productRows[i].id, presentation, ...categoryFootprint(category, presentation) }));
  });
  const slots: FaceSlot[] = layout.faces.map((f) => ({ faceId: f.id, grid: { columns: f.columns, rows: f.rows }, accepts: ACCEPTS[faceKinds.get(f.id)!] }));
  const { placed } = pack(slots, requests);
  const floor = placed.map((p) => ({
    id: newId(), storeId, productId: p.productId, presentation: p.presentation,
    faceId: p.faceId, col: p.col, row: p.row, colSpan: p.columns, rowSpan: p.rows,
  }));
  let nextBin = 0;
  const binned = DEMO_PRODUCTS.flatMap((p, i) =>
    p.plan === "B" || p.plan === "HB"
      ? [{ id: newId(), storeId, productId: productRows[i].id, presentation: "folded" as const, binId: bins[nextBin++ % bins.length].id }]
      : [],
  );

  return { layout, bins, categories, products: productRows, locations: [...floor, ...binned], images };
}

export function demoStatements(storeId: string, plan: DemoPlan): [BatchItem<"pg">, ...BatchItem<"pg">[]] {
  return [
    // Out with the old: categories take products, and products take their places and overrides.
    db.delete(productCategories).where(sql`${productCategories.storeId} = ${storeId}`),
    db.delete(stockroomBins).where(sql`${stockroomBins.storeId} = ${storeId}`),
    // Fixtures take their faces and table sets; then the rest of the map.
    db.delete(fixtures).where(sql`${fixtures.storeId} = ${storeId}`),
    db.delete(zones).where(sql`${zones.storeId} = ${storeId}`),
    db.delete(entrances).where(sql`${entrances.storeId} = ${storeId}`),
    db.delete(storeLayouts).where(sql`${storeLayouts.storeId} = ${storeId}`),
    // In with the new, through the editor's own write order.
    ...writeStatements(storeId, diff(EMPTY_LAYOUT, plan.layout), EMPTY_LAYOUT),
    db.insert(stockroomBins).values(plan.bins),
    db.insert(productCategories).values(plan.categories),
    db.insert(products).values(plan.products),
    db.insert(productLocations).values(plan.locations),
  ];
}
