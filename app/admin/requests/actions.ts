"use server";

// Company requests, decided by an admin (spec 0.7.1 5.3, 7.2): Approve, Reject and Ask a question. Each awaits the
// admin guard first and answers only a status. The admin is always the guard's, never a field of the form; of the
// browser only the request id, the version the admin looked at and the text are read.

import { requirePlatformAdminForAction } from "@/lib/admin/guard";
import { cleanReason } from "@/lib/admin/reason";
import { actorOf, type AdminReply, idOf, replyOf } from "@/lib/admin/replies";
import { approveRequest } from "@/lib/companies/approve";
import { askAboutRequest } from "@/lib/companies/request-ask";
import { rejectRequest } from "@/lib/companies/reject";

const versionOf = (raw: unknown): number | null => (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 1 ? raw : null);

export async function approveRequestAction(id: unknown, version: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const requestId = idOf(id);
  const seen = versionOf(version);
  if (!requestId || seen === null) return { status: "invalid" };
  return replyOf(await approveRequest(actorOf(check.admin), { id: requestId, version: seen }, reason));
}

export async function rejectRequestAction(id: unknown, version: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const requestId = idOf(id);
  const seen = versionOf(version);
  if (!requestId || seen === null) return { status: "invalid" };
  return replyOf(await rejectRequest(actorOf(check.admin), { id: requestId, version: seen }, reason));
}

export async function askQuestionAction(id: unknown, body: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const requestId = idOf(id);
  if (!requestId) return { status: "invalid" };
  return replyOf(await askAboutRequest(actorOf(check.admin), requestId, body));
}
