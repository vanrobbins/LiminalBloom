"use server";

// Help requests, answered by an admin (spec 0.7.1 7.4, 9.2): Reply and Close. Each awaits the admin guard first
// and answers only a status. The admin is always the guard's, never a field of the form.

import { adminCloseRequest, adminReplyTo, type AdminHelpOutcome } from "@/lib/admin/actions-help";
import { requirePlatformAdminForAction } from "@/lib/admin/guard";
import { cleanReason } from "@/lib/admin/reason";
import { actorOf, type AdminReply } from "@/lib/admin/replies";

export async function adminReplyHelpAction(id: unknown, body: unknown): Promise<AdminHelpOutcome | { status: "forbidden" }> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  return adminReplyTo(actorOf(check.admin), id, body);
}

export async function adminCloseHelpAction(id: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const { status } = await adminCloseRequest(actorOf(check.admin), id, reason);
  return { status: status === "done" || status === "gone" || status === "already" ? status : "invalid" };
}
