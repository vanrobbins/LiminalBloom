// Server Actions for the map editor. Each is a public entry point, so each
// checks the session itself (proposal §8.3). The store always comes from the
// session (getCurrentMember → resolveActiveStore), never from the browser, and
// both need the layout.edit switch (only the editor fetches; the viewer reloads
// the page). Signed-out is answered here, as before, so the editor can say its
// last change was not saved; requireSwitchForAction would redirect instead.

"use server";

import { getCurrentMember, requireSwitchForAction } from "@/lib/current-member";
import { parseChangeSet } from "@/lib/layout/change-schema";
import { loadLayout } from "@/lib/layout/load";
import type { FetchReply, SaveReply } from "@/lib/layout/replies";
import { applyLayoutChanges } from "@/lib/layout/save";

import { checkStore } from "./store-check";

export async function saveLayoutChanges(storeId: string, input: unknown): Promise<SaveReply> {
  const member = await getCurrentMember();
  if (member.kind !== "member") return { status: "signed-out" };
  if ((await requireSwitchForAction("layout.edit")).status === "forbidden") return { status: "forbidden" };
  if (checkStore(storeId, member.activeStoreId) === "store-changed") return { status: "store-changed" };

  const changes = parseChangeSet(input);
  if (!changes) return { status: "rejected", layout: await loadLayout(member.activeStoreId) };
  return applyLayoutChanges(member.activeStoreId, changes);
}

export async function fetchLayout(storeId: string): Promise<FetchReply> {
  const member = await getCurrentMember();
  if (member.kind !== "member") return { status: "signed-out" };
  if ((await requireSwitchForAction("layout.edit")).status === "forbidden") return { status: "forbidden" };
  if (checkStore(storeId, member.activeStoreId) === "store-changed") return { status: "store-changed" };
  return { status: "ok", layout: await loadLayout(member.activeStoreId) };
}
