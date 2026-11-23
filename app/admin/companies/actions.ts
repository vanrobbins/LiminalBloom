"use server";

// Help actions on a company (spec 0.7.1 7.4): Pause, Restore, Hand ownership to a corporate admin, Cancel invitation.
// Each awaits the admin guard first and answers only a status; the work and its events are in lib/admin.

import { cancelCompanyInvitationAsAdmin, handOffCompanyAsAdmin, pauseCompany, restoreCompany } from "@/lib/admin/actions-company";
import { requirePlatformAdminForAction } from "@/lib/admin/guard";
import { cleanReason } from "@/lib/admin/reason";
import { actorOf, idOf, replyOf, type AdminReply } from "@/lib/admin/replies";

const versionOf = (raw: unknown): number | null => (typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : null);

export async function pauseCompanyAction(companyId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const id = idOf(companyId);
  if (!id) return { status: "invalid" };
  return replyOf(await pauseCompany(actorOf(check.admin), id, reason));
}

export async function restoreCompanyAction(companyId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const id = idOf(companyId);
  if (!id) return { status: "invalid" };
  return replyOf(await restoreCompany(actorOf(check.admin), id, reason));
}

export async function handOffCompanyAction(companyId: unknown, userId: unknown, version: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const company = idOf(companyId);
  const person = idOf(userId);
  const seen = versionOf(version);
  if (!company || !person || seen === null) return { status: "invalid" };
  return replyOf(await handOffCompanyAsAdmin(actorOf(check.admin), company, person, seen, reason));
}

export async function cancelCompanyInvitationAction(invitationId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const id = idOf(invitationId);
  if (!id) return { status: "invalid" };
  return replyOf(await cancelCompanyInvitationAsAdmin(actorOf(check.admin), id, reason));
}
