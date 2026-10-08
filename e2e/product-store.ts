// Known products in the test account's home store for the search and library
// tests. Written as the owner, which row-level security does not restrict,
// like map-store.ts. Run seedLayout() first: the location needs Table 1.

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import { HOME_STORE, TEST_ACCOUNT } from "./test-account";

config({ path: ".env.local", quiet: true });

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local).");
  return neon(url);
}

async function homeStoreId(): Promise<string> {
  const rows = await sql()`
    select o.id from organization o
    join member m on m.organization_id = o.id
    join "user" u on u.id = m.user_id
    where u.email = ${TEST_ACCOUNT.email} and o.name = ${HOME_STORE}
    limit 1`;
  const id = rows[0]?.id;
  if (typeof id !== "string") throw new Error(`No store called ${HOME_STORE}.`);
  return id;
}

export async function seedCatalog(): Promise<void> {
  const db = sql();
  const store = await homeStoreId();
  // Categories take their products, and products their places.
  await db`delete from product_categories where store_id = ${store} and name like 'E2E %'`;
  const [pants] = await db`insert into product_categories (store_id, name) values (${store}, 'E2E Pants') returning id`;
  const [tees] = await db`insert into product_categories (store_id, name) values (${store}, 'E2E Tees') returning id`;
  const [pant] = await db`
    insert into products (store_id, name, style_number, category_id, color, size_range)
    values (${store}, 'E2E High-Rise Pant', 'E2E-HRP-01', ${pants.id}, 'Black', '0–14') returning id`;
  await db`
    insert into products (store_id, name, style_number, category_id, color)
    values (${store}, 'E2E Pocket Tee', 'E2E-PT-01', ${tees.id}, 'Navy')`;
  const [face] = await db`
    select ff.id from fixture_faces ff join fixtures f on f.id = ff.fixture_id
    where f.store_id = ${store} and f.name = 'Table 1' and ff.side = 'top'`;
  await db`
    insert into product_locations (store_id, product_id, presentation, face_id, col, row, col_span, row_span)
    values (${store}, ${pant.id}, 'folded', ${face.id}, 0, 0, 2, 2)`;
}

/** Puts the E2E products back to in stock, for a test that changed one. */
export async function resetE2eStatus(): Promise<void> {
  const store = await homeStoreId();
  await sql()`update products set status = 'in_stock' where store_id = ${store} and style_number like 'E2E-%'`;
}
