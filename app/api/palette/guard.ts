// The one check both palette answers share (spec §7): signed in with a store (401 otherwise),
// and holding `view` (403). The store is the member's active store from the session, never
// anything the request says. The answers are per person and per store, so never cached.

import { can, getCurrentMember, type Member } from "@/lib/current-member";

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function paletteMember(): Promise<{ member: Member } | { denied: Response }> {
  const member = await getCurrentMember();
  if (member.kind !== "member") return { denied: new Response(null, { status: 401, headers: PRIVATE_HEADERS }) };
  if (!can(member, "view")) return { denied: new Response(null, { status: 403, headers: PRIVATE_HEADERS }) };
  return { member };
}
