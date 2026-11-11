"use server";

// Changing people (spec 0.7, 4.7 and 4.8 part 4). Each action starts with the
// people.manage guard and then hands the person's own rank to the rank rule in
// lib/access/people-write.ts, which refuses what it must however the call was made:
// hiding a button is a courtesy. The store is the session's active store (CODESTYLE
// rule 8), never a requested one.

import { z } from "zod";

import { createInvitation, type InviteOutcome } from "@/lib/access/invite";
import { actorOf } from "@/lib/access/people";
import { cancelInvitation, changeRole, removePerson, type CancelOutcome, type ChangeOutcome, type PeopleActor, type RemoveOutcome } from "@/lib/access/people-write";
import { requireSwitchForAction, type Member } from "@/lib/current-member";

const id = z.string().min(1).max(200);
const roleOrNone = id.nullable();

const INVALID = { status: "invalid" } as const;

/** What the invite dialog is given: the expiry as ISO text, so it crosses into a client component. */
export type InviteResult = Exclude<InviteOutcome, { status: "created" }> | { status: "created"; id: string; email: string; roleName: string; expiresAt: string } | typeof INVALID;

function actorFor(member: Member): PeopleActor {
  return { ...actorOf(member), userId: member.user.id, name: member.user.name };
}

export async function changeRoleAction(memberId: unknown, expectedRoleId: unknown, newRoleId: unknown): Promise<ChangeOutcome> {
  const check = await requireSwitchForAction("people.manage");
  if (check.status === "forbidden") return { status: "forbidden" };
  const parsed = z.tuple([id, roleOrNone, id]).safeParse([memberId, expectedRoleId, newRoleId]);
  if (!parsed.success) return INVALID;
  return changeRole(check.member.activeStoreId, actorFor(check.member), ...parsed.data);
}

export async function removePersonAction(memberId: unknown, expectedRoleId: unknown): Promise<RemoveOutcome> {
  const check = await requireSwitchForAction("people.manage");
  if (check.status === "forbidden") return { status: "forbidden" };
  const parsed = z.tuple([id, roleOrNone]).safeParse([memberId, expectedRoleId]);
  if (!parsed.success) return INVALID;
  return removePerson(check.member.activeStoreId, actorFor(check.member), ...parsed.data);
}

export async function cancelInvitationAction(invitationId: unknown): Promise<CancelOutcome | { status: "invalid" }> {
  const check = await requireSwitchForAction("people.manage");
  if (check.status === "forbidden") return { status: "forbidden" };
  const parsed = id.safeParse(invitationId);
  if (!parsed.success) return INVALID;
  return cancelInvitation(check.member.activeStoreId, actorFor(check.member), parsed.data);
}

export async function createInvitationAction(email: unknown, roleId: unknown): Promise<InviteResult | { status: "forbidden" }> {
  const check = await requireSwitchForAction("people.manage");
  if (check.status === "forbidden") return { status: "forbidden" };
  const parsed = z.tuple([z.string().max(320), id]).safeParse([email, roleId]);
  if (!parsed.success) return INVALID;
  const out = await createInvitation(check.member.activeStoreId, actorFor(check.member), ...parsed.data);
  return out.status === "created" ? { ...out, expiresAt: out.expiresAt.toISOString() } : out;
}
