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
//
// A company person invites with no `member` row in the store (spec 0.7.1 6.4), so a second
// branch accepts an inviter who still holds a company role over the store's company: the
// owner, a corporate admin, or a regional manager of the store's region (every role whose
// store switches hold people.manage, company-roles.ts), the company not paused, and the
// role's rank strictly above the invitation's role. Ranks come from company-roles.ts. With
// `lock`, the company row and the assignment are locked FOR SHARE as the member branch is.

import "server-only";

import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { COMPANY_ROLES } from "./company-roles";
import type { Switch } from "./switches";

const MANAGE_PEOPLE: Switch = "people.manage";

/** True while the inviter may still grant the invitation's role. Not true: the invitation has lapsed. */
export const inviterMayGrant = (storeId: SQLWrapper, roleId: SQLWrapper, inviterId: SQLWrapper, lock = false) => sql`(exists (
  select 1 from member inviter_m
  join role_definitions inviter_r on inviter_r.store_id = inviter_m.organization_id and inviter_r.id = inviter_m.role_id
  join role_definitions granted_r on granted_r.store_id = ${storeId} and granted_r.id = ${roleId}
  where inviter_m.organization_id = ${storeId} and inviter_m.user_id = ${inviterId}
    and (${MANAGE_PEOPLE}::text = any (inviter_r.switches) or inviter_r.builtin = 'store_manager')
    and inviter_r.rank < granted_r.rank
  ${lock ? sql`for share of inviter_m, inviter_r` : sql``}) or ${companyInviterMayGrant(storeId, roleId, inviterId, lock)})`;

/** The company branch: the inviter holds a company role that reaches this store and outranks the invitation's role. */
function companyInviterMayGrant(storeId: SQLWrapper, roleId: SQLWrapper, inviterId: SQLWrapper, lock: boolean): SQL {
  const roles = COMPANY_ROLES.filter((r) => r.storeSwitches.includes(MANAGE_PEOPLE));
  const base = sql`from store_profiles sp
    join companies c on c.id = sp.company_id and c.suspended_at is null
    join role_definitions granted_r on granted_r.store_id = sp.store_id and granted_r.id = ${roleId}`;
  const owner = roles.find((r) => r.key === "owner");
  const held = roles
    .filter((r) => r.key !== "owner")
    // A regional manager reaches only the stores of their own region.
    .map((r) => sql`(ra.role::text = ${r.key} and ${r.rank} < granted_r.rank${r.key === "regional_manager" ? sql` and ra.region_id = sp.region_id` : sql``})`);
  const byOwner = owner ? sql`exists (select 1 ${base} where sp.store_id = ${storeId} and c.owner_user_id = ${inviterId} and ${owner.rank} < granted_r.rank ${lock ? sql`for share of c` : sql``})` : sql`false`;
  const byRole =
    held.length > 0
      ? sql`exists (select 1 ${base} join role_assignments ra on ra.company_id = c.id and ra.user_id = ${inviterId}
          where sp.store_id = ${storeId} and (${sql.join(held, sql` or `)}) ${lock ? sql`for share of c, ra` : sql``})`
      : sql`false`;
  return sql`(${byOwner} or ${byRole})`;
}
