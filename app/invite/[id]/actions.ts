"use server";

// Accepting an invitation (spec 0.7, 4.8). A server action is a public entry point
// (proposal 8.3), so it checks the session itself. The person, and the email the
// invitation must match, come from the session, never from an argument. This is
// not behind a permission switch: the person has no store or role yet, which is
// the point (app/server-actions-guard.test.ts names it, with the reason).

import { headers } from "next/headers";
import { z } from "zod";

import { acceptInvitation, type AcceptOutcome } from "@/lib/access/invitation-accept";
import { setActiveStore } from "@/lib/access/set-active-store";
import { auth } from "@/lib/auth";

export type AcceptResult = Exclude<AcceptOutcome, { status: "accepted" }> | { status: "accepted"; storeName: string; roleName: string } | { status: "signed-out" | "invalid" };

export async function acceptInvitationAction(invitationId: unknown): Promise<AcceptResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return { status: "signed-out" };
  const parsed = z.string().min(1).max(200).safeParse(invitationId);
  if (!parsed.success) return { status: "invalid" };

  const out = await acceptInvitation({ id: session.user.id, name: session.user.name, email: session.user.email }, parsed.data);
  if (out.status !== "accepted") return out;

  // Open the store they just joined. If this fails they are still in: the next
  // request opens a store they belong to (resolveAccess), so say accepted.
  try {
    await setActiveStore(session.session.id, session.user.id, out.storeId);
  } catch (error) {
    console.error("accept invitation: store not made active", out.storeId, error);
  }
  return { status: "accepted", storeName: out.storeName, roleName: out.roleName };
}
