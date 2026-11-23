"use server";

// Help actions on a person (spec 0.7.1 7.4): Sign out everywhere, Cancel invitation, Reset two-factor.
// Each awaits the admin guard first and answers only a status; the work and its events are in lib/admin.

import { cancelStoreInvitation, signOutEverywhere } from "@/lib/admin/actions-core";
import { resetAccountTwoFactor } from "@/lib/admin/actions-two-factor";
import { requirePlatformAdminForAction } from "@/lib/admin/guard";
import { cleanReason } from "@/lib/admin/reason";
import { actorOf, idOf, replyOf, type AdminReply } from "@/lib/admin/replies";

export async function signOutEverywhereAction(userId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const id = idOf(userId);
  if (!id) return { status: "invalid" };
  return replyOf(await signOutEverywhere(actorOf(check.admin), id, reason));
}

export async function cancelInvitationAction(invitationId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const id = idOf(invitationId);
  if (!id) return { status: "invalid" };
  return replyOf(await cancelStoreInvitation(actorOf(check.admin), id, reason));
}

export async function resetTwoFactorAction(userId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const id = idOf(userId);
  if (!id) return { status: "invalid" };
  return replyOf(await resetAccountTwoFactor(actorOf(check.admin), id, reason));
}
