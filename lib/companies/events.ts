// The record of what happens in a company (company_events, insert-only), spec 0.7.1 6.2. Every write on /company
// records its row in the same statement as the change, so neither exists without the other: this is the logging
// half of that statement. The actor comes from the action's guard, never the browser.

import "server-only";

import { sql, type SQL } from "drizzle-orm";

export type CompanyActor = { userId: string; name: string };

/**
 * A CTE body that inserts one company_events row for each row the CTE named `from` returned (a fixed name in
 * the caller's own SQL, never a value from outside). `detail` is a jsonb expression that may read the row as `r`.
 */
export function logCompanyEvent(companyId: string, actor: CompanyActor, event: string, from: string, detail: SQL): SQL {
  return sql`insert into company_events (company_id, actor_id, actor_name, event, detail)
    select ${companyId}::text, ${actor.userId}::text, ${actor.name}::text, ${event}::text, ${detail} from ${sql.raw(from)} r returning id`;
}
