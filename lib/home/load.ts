// Everything Home shows, for one viewer (spec 0.7.0.6 section 5.4). `readsFor` says
// which reads this viewer needs and only those run, together; a card's data goes
// into the result only when the viewer holds its switches, so a viewer is never
// sent (and the loader never reads) what they may not see. Emails live in the
// invitation rows and the change lines, which only people.manage reaches.

import "server-only";

import { invitationRowsFor, memberCount } from "@/lib/access/people";
import { readActivity } from "@/lib/access/roles-read";
import type { Member } from "@/lib/current-member";
import { loadLayout } from "@/lib/layout/load";
import { planogramList } from "@/lib/planograms/list";
import { planogramSummaries } from "@/lib/planograms/queries";
import { storeTimezone } from "@/lib/store-settings";
import { storeToday } from "@/lib/time/format";

import { cardAllowed, readsFor } from "./cards";
import { fixturesWithoutPlanogram, planogramWork } from "./planogram-work";
import { homeReads } from "./queries";
import { setupSteps } from "./setup-steps";
import type { ChangeRow, HomeData, InvitationRow } from "./types";

const CHANGES_SHOWN = 5;

export async function loadHome(member: Member, now: Date = new Date()): Promise<HomeData> {
  const storeId = member.activeStoreId;
  const reads = readsFor(member);
  const [layout, summaries, zone, batch, invitations, members, activity] = await Promise.all([
    reads.planograms ? loadLayout(storeId) : null,
    reads.summaries ? planogramSummaries(storeId) : null,
    reads.summaries ? storeTimezone(storeId) : null,
    reads.batch ? homeReads(storeId, { soldOut: reads.soldOut }) : null,
    reads.invitations ? invitationRowsFor(member, now) : null,
    reads.invitations ? memberCount(storeId) : null,
    reads.activity ? readActivity(member, CHANGES_SHOWN) : null,
  ]);

  const data: HomeData = {};
  const groups = layout && summaries ? planogramList(layout, summaries) : null;
  // Setup's facts come only from reads that ran; a fact that wasn't read belongs to a row the viewer's switches already hide.
  const invitationRows: InvitationRow[] | null = invitations && invitations.map((i) => ({ id: i.id, email: i.email, roleName: i.roleName, state: i.expired ? "expired" : i.lapsed ? "lapsed" : "pending", expiresAt: new Date(i.expiresAt) }));

  if (cardAllowed(member, "setup")) {
    data.setup = setupSteps(
      {
        hasOutline: layout ? layout.outline !== null : true,
        productCount: batch?.productCount ?? 1,
        memberCount: members ?? 2,
        pendingInvitations: invitationRows?.filter((i) => i.state === "pending").length ?? 0,
      },
      member,
    );
  }
  if (groups && zone && cardAllowed(member, "planograms")) data.planograms = planogramWork(groups, storeToday(zone, now));
  if (invitationRows && cardAllowed(member, "invitations")) data.invitations = invitationRows;
  if (groups && batch && cardAllowed(member, "notPlaced")) data.notPlaced = { products: batch.unplacedCount, fixtures: fixturesWithoutPlanogram(groups) };
  if (batch?.soldOutCount != null && cardAllowed(member, "soldOut")) data.soldOut = { products: batch.soldOutCount };
  if (batch && cardAllowed(member, "published")) data.published = batch.recentPublishes;
  if (activity && cardAllowed(member, "changes")) data.changes = activity.map((a): ChangeRow => ({ id: a.id, text: a.text, at: new Date(a.at) }));
  return data;
}
