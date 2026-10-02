// Puts the test account's home store layout into a known state before each
// map test. Talks to the development database directly, as the owner, which
// row-level security does not restrict, because setup is not what is being tested.

import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import { HOME_STORE, TEST_ACCOUNT } from "./test-account";

config({ path: ".env.local" });

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local).");
  return neon(url);
}

async function storeId(name: string): Promise<string> {
  const rows = await sql()`
    select o.id from organization o
    join member m on m.organization_id = o.id
    join "user" u on u.id = m.user_id
    where u.email = ${TEST_ACCOUNT.email} and o.name = ${name}
    limit 1`;
  const id = rows[0]?.id;
  if (typeof id !== "string") throw new Error(`No store called ${name} for ${TEST_ACCOUNT.email}.`);
  return id;
}

export async function resetLayout(storeName: string = HOME_STORE): Promise<void> {
  const db = sql();
  const store = await storeId(storeName);
  // Faces and table sets go with their fixtures (cascade).
  await db`delete from fixtures where store_id = ${store}`;
  await db`delete from zones where store_id = ${store}`;
  await db`delete from entrances where store_id = ${store}`;
  await db`delete from store_layouts where store_id = ${store}`;
}

export async function seedLayout(): Promise<void> {
  await resetLayout();
  const db = sql();
  const store = await storeId(HOME_STORE);
  const outline = JSON.stringify([{ x: 0, y: 0 }, { x: 480, y: 0 }, { x: 480, y: 360 }, { x: 0, y: 360 }]);
  const zone = JSON.stringify([{ x: 0, y: 0 }, { x: 240, y: 0 }, { x: 240, y: 180 }, { x: 0, y: 180 }]);
  const table = randomUUID();
  await db`insert into store_layouts (store_id, outline) values (${store}, ${outline}::jsonb)`;
  await db`insert into zones (id, store_id, name, type, color, points) values (${randomUUID()}, ${store}, 'Front tables', 'display', 'zone-1', ${zone}::jsonb)`;
  await db`insert into fixtures (id, store_id, type, name, x, y, width, depth) values (${table}, ${store}, 'table', 'Table 1', 360, 100, 72, 36)`;
  await db`insert into fixture_faces (id, store_id, fixture_id, side, grid_columns, grid_rows) values (${randomUUID()}, ${store}, ${table}, 'top', 6, 3)`;
}

/** What a store's layout holds, for checking that a refused save wrote nothing. */
export async function layoutCounts(storeName: string): Promise<{ fixtures: number; table1X: number | null }> {
  const db = sql();
  const rows = await db`
    select f.name, f.x from fixtures f
    join organization o on o.id = f.store_id
    join member m on m.organization_id = o.id
    join "user" u on u.id = m.user_id
    where u.email = ${TEST_ACCOUNT.email} and o.name = ${storeName}`;
  const table = rows.find((row) => row.name === "Table 1");
  return { fixtures: rows.length, table1X: table ? Number(table.x) : null };
}
