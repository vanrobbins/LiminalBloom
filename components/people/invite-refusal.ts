// What the invite dialog says when the server refuses (spec 0.7, 4.8 part 5).

import type { InviteResult } from "@/app/(app)/people/actions";
import { MAX_INVITATIONS, MAX_PEOPLE } from "@/lib/access/invite-limits";

export type InviteRefusal = Exclude<InviteResult, { status: "created" }> | { status: "forbidden" };

export function inviteRefusalText(refusal: InviteRefusal): string {
  switch (refusal.status) {
    case "bad-email":
      return "Enter an email address.";
    case "already-member":
      return `${refusal.name} is already in this store.`;
    case "already-invited":
      return "An invitation is already waiting for this email. Copy its link or cancel it first.";
    case "people-full":
      return `This store has ${MAX_PEOPLE} people, the most it can hold.`;
    case "invitations-full":
      return `${MAX_INVITATIONS} invitations are waiting, the most allowed. Cancel some first.`;
    case "forbidden":
      return "Your role can't invite into that role.";
    case "invalid":
      return "That role isn't available. Close and look again.";
  }
}
