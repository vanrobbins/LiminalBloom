// The help actions on one store (spec 0.7.1 7.4), in its header on /admin/stores/[id]: Pause or Restore, and
// Make Store Manager beside a person who is not one. Cancel invitation is in person-actions.tsx.

"use client";

import { CirclePause, CirclePlay, UserCheck } from "lucide-react";

import { makeStoreManagerAction, pauseStoreAction, restoreStoreAction } from "@/app/admin/stores/actions";

import { AdminAction } from "./admin-action";

export function PauseRestore({ storeId, storeName, paused }: { storeId: string; storeName: string; paused: boolean }) {
  return paused ? (
    <AdminAction
      label="Restore"
      icon={CirclePlay}
      title={`Restore ${storeName}?`}
      description="The store opens again for everyone in it, as it was. Nothing was deleted while it was paused."
      confirm="Restore store"
      loadingText="Restoring…"
      doneToast="Store restored."
      messages={{ already: "That store isn't paused. Close and look again." }}
      run={(reason) => restoreStoreAction(storeId, reason)}
    />
  ) : (
    <AdminAction
      label="Pause"
      icon={CirclePause}
      buttonVariant="quiet-danger"
      title={`Pause ${storeName}?`}
      description="The store drops out of everyone's list and nobody can open it until it is restored. Nothing is deleted. People with no other store see a page saying so."
      confirm="Pause store"
      loadingText="Pausing…"
      variant="danger"
      doneToast="Store paused."
      messages={{ already: "That store is already paused. Close and look again." }}
      run={(reason) => pauseStoreAction(storeId, reason)}
    />
  );
}

export function MakeManager({ storeId, storeName, userId, name }: { storeId: string; storeName: string; userId: string; name: string }) {
  return (
    <AdminAction
      label="Make Store Manager"
      icon={UserCheck}
      title={`Make ${name} a Store Manager?`}
      description={`${name} becomes a Store Manager of ${storeName}. Its other Store Managers keep their role.`}
      confirm="Make Store Manager"
      loadingText="Saving…"
      messages={{ already: `${name} is already a Store Manager. Close and look again.`, invalid: "This store has no Store Manager role. Close and look again." }}
      run={(reason) => makeStoreManagerAction(storeId, userId, reason)}
    />
  );
}
