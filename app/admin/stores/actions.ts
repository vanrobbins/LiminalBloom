"use server";

// Help actions on a store (spec 0.7.1 7.4): Pause, Restore, Make Store Manager. Cancel invitation is
// app/admin/people/actions.ts. Each awaits the admin guard first and answers only a status.

import { makeStoreManager } from "@/lib/admin/actions-core";
import { pauseStore, restoreStore } from "@/lib/admin/actions-pause";
import { requirePlatformAdminForAction } from "@/lib/admin/guard";
import { cleanReason } from "@/lib/admin/reason";
import { actorOf, idOf, replyOf, type AdminReply } from "@/lib/admin/replies";

export async function pauseStoreAction(storeId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const id = idOf(storeId);
  if (!id) return { status: "invalid" };
  return replyOf(await pauseStore(actorOf(check.admin), id, reason));
}

export async function restoreStoreAction(storeId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const id = idOf(storeId);
  if (!id) return { status: "invalid" };
  return replyOf(await restoreStore(actorOf(check.admin), id, reason));
}

export async function makeStoreManagerAction(storeId: unknown, userId: unknown, reasonText: unknown): Promise<AdminReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return { status: "forbidden" };
  const reason = cleanReason(reasonText);
  if (!reason) return { status: "invalid-reason" };
  const store = idOf(storeId);
  const person = idOf(userId);
  if (!store || !person) return { status: "invalid" };
  return replyOf(await makeStoreManager(actorOf(check.admin), store, person, reason));
}
