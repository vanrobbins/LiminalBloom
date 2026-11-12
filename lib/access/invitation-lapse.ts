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
// and the reads can show the same answer. The three arguments name the invitation's
// store, role and inviter columns in whatever statement it sits in.
//
// What the accept statement guarantees, and what it does not. With `lock`, the inviter's
// member row and role row are locked FOR SHARE while the check runs: a removal or role
// change that is still uncommitted when the accept starts is waited for, and the accept
// sees its result. A change that commits after the lock is taken waits for the accept
// to finish (it then applies to an accept that already won, which is the same order as
// the change coming a moment later). The invitation's own role row is not locked: a
// concurrent rank change to it is the accepted-either-way window, like any change made a
// moment after an accept. The reads (page, People, duplicate check) do not lock.

import "server-only";

import { sql, type SQLWrapper } from "drizzle-orm";

import type { Switch } from "./switches";

const MANAGE_PEOPLE: Switch = "people.manage";

/** True while the inviter may still grant the invitation's role. Not true: the invitation has lapsed. */
export const inviterMayGrant = (storeId: SQLWrapper, roleId: SQLWrapper, inviterId: SQLWrapper, lock = false) => sql`exists (
  select 1 from member inviter_m
  join role_definitions inviter_r on inviter_r.store_id = inviter_m.organization_id and inviter_r.id = inviter_m.role_id
  join role_definitions granted_r on granted_r.store_id = ${storeId} and granted_r.id = ${roleId}
  where inviter_m.organization_id = ${storeId} and inviter_m.user_id = ${inviterId}
    and (${MANAGE_PEOPLE}::text = any (inviter_r.switches) or inviter_r.builtin = 'store_manager')
    and inviter_r.rank < granted_r.rank
  ${lock ? sql`for share of inviter_m, inviter_r` : sql``})`;
