"use server";

// Add and remove a Liminal Bloom admin (spec 0.7.1 7.1). Each awaits the admin guard first and answers only a status.

import { addAdmin, removeAdmin } from "@/lib/admin/admins";
import { requirePlatformAdminForAction } from "@/lib/admin/guard";
import { cleanReason } from "@/lib/admin/reason";
import { actorOf, idOf, replyOf, type AdminReply } from "@/lib/admin/replies";

const MAX_EMAIL = 254;

export async function addAdminAction(email: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  if (typeof email !== "string" || email.trim() === "" || email.length > MAX_EMAIL) return { status: "no-account" };
  return replyOf(await addAdmin(actorOf(check.admin), email, reason));
}

export async function removeAdminAction(userId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const id = idOf(userId);
  if (!id) return { status: "invalid" };
  return replyOf(await removeAdmin(actorOf(check.admin), id, reason));
}
