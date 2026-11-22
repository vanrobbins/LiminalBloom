// A published planogram on a worker's own store, for the Quick Adjust specs (0.7.0.9 task 8). Table 1 holds the E2E
// High-Rise Pant (4 x 2 cells), published as Version 1, and an in-stock second pant (same category and colour, so the
// first suggestion) is not placed. The role store keeps no layout (access-staff asserts it), so the role specs swap
// the worker's own role in its own store instead. Rows are written straight to the development database as the owner,
// like map-store.ts and home-store.ts.

import { randomUUID } from "node:crypto";

import type { BuiltinRoleKey } from "../lib/access/roles";

import { seedLayout, sql, storeId } from "./map-store";
import { seedCatalog } from "./product-store";
import { HOME_STORE, TEST_ACCOUNT } from "./test-account";

export const PANT = "E2E High-Rise Pant";
export const SLIM = "E2E Slim Pant";

export type AdjustSeed = { store: string; fixtureId: string; planId: string; faceId: string; pantId: string; slimId: string; adjustUrl: string };

export async function seedAdjustable(): Promise<AdjustSeed> {
  await seedLayout();
  await seedCatalog();
  await actAs("store_manager");
  const db = sql();
  const store = await storeId(HOME_STORE);
  const [pant] = await db`select id, category_id from products where store_id = ${store} and style_number = 'E2E-HRP-01'`;
  const [slim] = await db`insert into products (store_id, name, style_number, category_id, color, size_range) values (${store}, ${SLIM}, 'E2E-SP-01', ${pant.category_id}, 'Black', '0–14') returning id`;
  const [fixture] = await db`select id from fixtures where store_id = ${store} and name = 'Table 1'`;
  const [face] = await db`select id from fixture_faces where store_id = ${store} and fixture_id = ${fixture.id}`;
  const planId = randomUUID();
  await db`insert into planograms (id, store_id, fixture_id, has_draft, published_version) values (${planId}, ${store}, ${fixture.id}, false, 1)`;
  const entry = {
    faceId: face.id, faceLabel: "Top", side: "top", fixtureId: fixture.id, fixtureName: "Table 1", productId: pant.id, productName: PANT,
    styleNumber: "E2E-HRP-01", presentation: "folded", col: 0, row: 0, colSpan: 4, rowSpan: 2, pieceCount: 1, depth: 0,
  };
  await db`insert into planogram_versions (store_id, planogram_id, number, published_by_name, placements) values (${store}, ${planId}, 1, 'Pat Publisher', ${JSON.stringify([entry])}::jsonb)`;
  const ids = { store, fixtureId: String(fixture.id), planId, faceId: String(face.id), pantId: String(pant.id), slimId: String(slim.id) };
  return { ...ids, adjustUrl: `/planograms/${ids.fixtureId}/adjust?product=${ids.pantId}` };
}

/** A monthly draft open on the planogram: the pant as Version 1 has it, so publishing it would end a Quick Adjust. */
export async function startMonthlyDraft(seed: AdjustSeed): Promise<void> {
  const db = sql();
  await db`update planograms set has_draft = true, based_on_version = 1, version = version + 1 where id = ${seed.planId}`;
  await db`insert into planogram_placements (id, store_id, planogram_id, face_id, product_id, presentation, col, row, col_span, row_span, piece_count) values (${randomUUID()}, ${seed.store}, ${seed.planId}, ${seed.faceId}, ${seed.pantId}, 'folded', 0, 0, 4, 2, 1)`;
}

export const markStatus = (seed: AdjustSeed, id: string, status: "in_stock" | "sold_out" | "on_sale") => sql()`update products set status = ${status} where store_id = ${seed.store} and id = ${id}`;

/** Quick Adjusts of the planogram by state, as the database has them. */
export async function adjustmentStates(seed: AdjustSeed): Promise<string[]> {
  const found = await sql()`select state || coalesce(':' || ended_reason, '') as s from planogram_adjustments where planogram_id = ${seed.planId} order by created_at`;
  return found.map((r) => String(r.s));
}

/** The names of the products on the floor of Table 1, by their location rows. */
export async function floorNames(seed: AdjustSeed): Promise<string[]> {
  const rows = await sql()`select p.name from product_locations l join products p on p.id = l.product_id where l.store_id = ${seed.store} and l.face_id = ${seed.faceId} order by p.name`;
  return rows.map((r) => String(r.name));
}

/** Makes the worker's own account hold this built-in role in its home store (read afresh on each request). */
export async function actAs(key: BuiltinRoleKey): Promise<void> {
  const db = sql();
  const store = await storeId(HOME_STORE);
  const [role] = await db`select id from role_definitions where store_id = ${store} and builtin = ${key}`;
  await db`update member set role_id = ${role.id} where organization_id = ${store} and user_id = (select id from "user" where email = ${TEST_ACCOUNT.email})`;
}
