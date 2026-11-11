// What the invitation page and /welcome say when an invitation can't be used
// (spec 0.7, 4.8). One plain message each: nothing here names the invited
// address or the people in the store.

import type { AcceptResult } from "@/app/invite/[id]/actions";
import type { InvitationState } from "@/lib/access/invitation-look";
import { MAX_PEOPLE } from "@/lib/access/invite-limits";

type Unusable = Exclude<InvitationState["state"], "ready" | "signed-out">;

export function unusableText(state: Unusable | "stale", storeName?: string): string {
  switch (state) {
    case "missing":
      return "This invitation link isn't valid. Check that you copied all of it, or ask for a new one.";
    case "used":
      return "This invitation was already used.";
    case "cancelled":
      return "This invitation was cancelled. Ask for a new one.";
    case "expired":
      return "This invitation has expired. Ask for a new one.";
    case "wrong-email":
      return "This invitation was sent to a different email address than the one you're signed in with. Sign in with the address it was sent to.";
    case "already-member":
      return `You're already in ${storeName ?? "this store"}.`;
    case "full":
      return `${storeName ?? "This store"} has ${MAX_PEOPLE} people, the most it can hold. Ask a manager to make room.`;
    case "stale":
      return "Something changed while you were joining. Reload the page and try again.";
  }
}

export const NETWORK_TEXT = "Couldn't join. Check your connection and try again.";

/** The message for an accept that didn't succeed. */
export function acceptRefusalText(result: Exclude<AcceptResult, { status: "accepted" }>, storeName: string): string {
  if (result.status === "signed-out") return "You're signed out. Sign in again, then open the invitation link.";
  if (result.status === "invalid") return unusableText("missing");
  return unusableText(result.status, storeName);
}
