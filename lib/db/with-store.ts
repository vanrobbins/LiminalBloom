// Every query on a store's map runs through here (spec §8). It opens one
// transaction (a Neon HTTP batch), scopes it to the store, and switches to a
// role that row-level security applies to. The app's own connection is the
// table owner, which RLS ignores; that is why the role switch matters.
//
// The store id must come from requireMember() / getCurrentMember(), never
// from a request (docs/CODESTYLE.md rule 8). Both settings are LOCAL: they
// end with the transaction, so nothing carries over to the next request
// (proved in plan Task 1).

import "server-only";

import { sql } from "drizzle-orm";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";

import { db } from "@/db";

type Queries = readonly [BatchItem<"pg">, ...BatchItem<"pg">[]];

export async function withStore<Q extends Queries>(
  storeId: string,
  queries: Q,
): Promise<BatchResponse<Q>> {
  if (!storeId) {
    throw new Error("withStore needs a store id.");
  }

  const results = await db.batch([
    db.execute(sql`select set_config('app.store_id', ${storeId}, true)`),
    db.execute(sql`set local role app_store_user`),
    ...queries,
  ]);

  // Drop the two setup results; callers get theirs in the order they gave them.
  return results.slice(2) as unknown as BatchResponse<Q>;
}
