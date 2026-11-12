// When an invitation lapses (DECISIONS 11-12): it carries its inviter's authority, so it
// stops working once the inviter could no longer have made it. This is the SQL form of
// the rule invite.ts applied at creation, `canActOn(inviter, role.rank, "people.manage")`
// (rank.ts), over the inviter's role as it is now: still a member of the store, that role
// holds people.manage, and its rank is strictly above the invitation's role. A Store
// Manager always holds people.manage (the lock in roles.ts `withLockedSwitches`, which
// resolveAccess applies on read), so the builtin check stands in for it here. An inviter
// with no role (or a deleted one) joins to nothing, so the invitation lapses: nothing
// fails open.
//
// It is a fragment, not a query, so accepting can put it inside the accept statement
// (a change that lands meanwhile cannot slip through) and the reads can show the same
// answer. The three arguments name the invitation's store, role and inviter columns in
// whatever statement it sits in.

import "server-only";

import { sql, type SQLWrapper } from "drizzle-orm";

import type { Switch } from "./switches";

const MANAGE_PEOPLE: Switch = "people.manage";

/** True while the inviter may still grant the invitation's role. Not true: the invitation has lapsed. */
export const inviterMayGrant = (storeId: SQLWrapper, roleId: SQLWrapper, inviterId: SQLWrapper) => sql`exists (
  select 1 from member inviter_m
  join role_definitions inviter_r on inviter_r.store_id = inviter_m.organization_id and inviter_r.id = inviter_m.role_id
  join role_definitions granted_r on granted_r.store_id = ${storeId} and granted_r.id = ${roleId}
  where inviter_m.organization_id = ${storeId} and inviter_m.user_id = ${inviterId}
    and (${MANAGE_PEOPLE}::text = any (inviter_r.switches) or inviter_r.builtin = 'store_manager')
    and inviter_r.rank < granted_r.rank)`;
