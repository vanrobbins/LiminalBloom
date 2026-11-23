// Planogram work on a worker's own store, for the Home specs (0.7.0.6 task 9). The role store keeps no layout
// (access-staff asserts it), so the Planograms to finish, Not placed yet and Recently published cards are
// tested here. Rows are written straight to the development database as the owner, like map-store.ts.

import { randomUUID } from "node:crypto";

import { formatDay } from "../lib/planograms/dates";
import { storeToday } from "../lib/time/format";
import { DEFAULT_TIMEZONE } from "../lib/time/zones";

import { resetLayout, seedLayout, seedRack, seedWallBay, sql, storeId } from "./map-store";
import { seedCatalog } from "./product-store";
import { HOME_STORE } from "./test-account";

/** A calendar day (YYYY-MM-DD) some days from another. */
export function addDays(iso: string, days: number): string {
  const day = new Date(`${iso}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export type HomeSeed = { today: string; overdue: string; upcoming: string; ids: Record<"table" | "rack" | "draft" | "published", string>; publisher: string };

async function fixtureId(store: string, name: string): Promise<string> {
  const [row] = await sql()`select id from fixtures where store_id = ${store} and name = ${name}`;
  return String(row.id);
}

/**
 * Table 1: draft, due three days ago. Rack 1: draft, due in five. Wall A: undated draft. Wall B: published
 * once, no draft, no date. Wall C: no planogram. Run again for a fresh state; it starts from seedLayout.
 */
export async function seedHomeWork(): Promise<HomeSeed> {
  await seedLayout();
  await seedCatalog();
  await seedRack("Rack 1");
  await seedWallBay("Wall A", 0, 0);
  await seedWallBay("Wall B", 60, 0);
  await seedWallBay("Wall C", 120, 0);
  const db = sql();
  const store = await storeId(HOME_STORE);
  const [settings] = await db`select timezone from store_settings where store_id = ${store}`;
  const today = storeToday(settings ? String(settings.timezone) : DEFAULT_TIMEZONE);
  const overdue = addDays(today, -3);
  const upcoming = addDays(today, 5);
  const ids = { table: await fixtureId(store, "Table 1"), rack: await fixtureId(store, "Rack 1"), draft: await fixtureId(store, "Wall A"), published: await fixtureId(store, "Wall B") };
  const plan = (fixture: string, hasDraft: boolean, due: string | null, published: number | null) =>
    db`insert into planograms (id, store_id, fixture_id, has_draft, due_date, published_version) values (${randomUUID()}, ${store}, ${fixture}, ${hasDraft}, ${due}, ${published}) returning id`;
  await plan(ids.table, true, overdue, null);
  await plan(ids.rack, true, upcoming, null);
  await plan(ids.draft, true, null, null);
  const [published] = await plan(ids.published, false, null, 1);
  const publisher = "Pat Publisher";
  await db`insert into planogram_versions (store_id, planogram_id, number, published_by_name, placements) values (${store}, ${published.id}, 1, ${publisher}, '[]'::jsonb)`;
  return { today, overdue, upcoming, ids, publisher };
}

/** Removes what seedHomeWork made (the layout goes with its planograms and versions). */
export const clearHomeWork = () => resetLayout();

/** Products in a store with no place on a face or in a bin: what Not placed yet counts. */
export async function unplacedProducts(store: string): Promise<number> {
  const [row] = await sql()`select count(*)::int as n from products p where p.store_id = ${store} and not exists (select 1 from product_locations l where l.store_id = p.store_id and l.product_id = p.id)`;
  return Number(row.n);
}

export const homeStoreId = () => storeId(HOME_STORE);

/** The row text the planogram card's link carries: "Table 1, Draft, Overdue · Nov 10". */
export const dueText = (iso: string, today: string) => `${iso < today ? "Overdue · " : "Due "}${formatDay(iso)}`;

/**
 * Quick Adjust work for the Home cards (0.7.0.9): the placed E2E pant sold out (it sits on Table 1), and a Quick Adjust
 * draft on the published planogram. Undo with `endAdjustWork`.
 */
export async function startAdjustWork(publishedFixtureId: string): Promise<void> {
  const db = sql();
  const store = await homeStoreId();
  await db`update products set status = 'sold_out' where store_id = ${store} and style_number = 'E2E-HRP-01'`;
  const [plan] = await db`select id from planograms where store_id = ${store} and fixture_id = ${publishedFixtureId}`;
  await db`insert into planogram_adjustments (store_id, planogram_id, based_on_version, state, created_by_name) values (${store}, ${plan.id}, 1, 'draft', 'Pat Publisher')`;
}

export async function endAdjustWork(): Promise<void> {
  const db = sql();
  const store = await homeStoreId();
  await db`delete from planogram_adjustments where store_id = ${store}`;
  await db`update products set status = 'in_stock' where store_id = ${store} and style_number = 'E2E-HRP-01'`;
}
