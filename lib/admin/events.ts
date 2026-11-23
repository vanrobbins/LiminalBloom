// Writing what an admin did (spec 0.7.1 7.4, 7.5). Every help action is ONE statement: data-modifying
// CTEs that change the rows and insert the `platform_events` row (and, where a store is touched, its
// `access_events` row signed "Liminal Bloom", never naming the admin) from the rows that changed. So an
// action that changes nothing writes no event, and a failed event insert undoes the change.
//
// The helpers return the INSERT ... SELECT pieces; each action's statement supplies the CTE they read from.
// Runs as the table owner, like everything under lib/admin.

import "server-only";

import { sql, type SQL } from "drizzle-orm";

/** The signed-in admin, as the action's guard resolved them on this request. */
export type AdminActor = { userId: string; name: string };

/** What the store's Recent changes names as the actor of a help action. */
export const LIMINAL_BLOOM = "Liminal Bloom";

export type EventSpec = {
  action: string;
  targetKind: "user" | "store" | "invitation" | "company" | "company_request" | "admin" | "help_request";
  /** A literal, or an expression over the source rows. */
  targetId: string | SQL;
  targetLabel: string | SQL;
  reason: string;
  detail?: SQL;
};

const text = (v: string | SQL): SQL => (typeof v === "string" ? sql`${v}::text` : v);

/** `insert into platform_events ... select ... from <source>`: one row per source row. */
export function platformEventFrom(actor: AdminActor, spec: EventSpec, source: SQL): SQL {
  return sql`insert into platform_events (actor_id, actor_name, action, target_kind, target_id, target_label, reason, detail)
    select ${actor.userId}::text, ${actor.name}::text, ${spec.action}::text, ${spec.targetKind}::text, ${text(spec.targetId)}, ${text(spec.targetLabel)}, ${spec.reason}::text, ${spec.detail ?? sql`'{}'::jsonb`}
    from ${source}`;
}

/** `insert into access_events ... select ... from <source>`: the store's own record, actor "Liminal Bloom" with no actor id. */
export function storeEventFrom(storeId: string | SQL, event: string, detail: SQL, source: SQL): SQL {
  return sql`insert into access_events (store_id, actor_id, actor_name, event, detail)
    select ${text(storeId)}, null, ${LIMINAL_BLOOM}::text, ${event}::text, ${detail}
    from ${source}`;
}
