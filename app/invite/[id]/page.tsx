// An invitation link (spec 0.7, 4.8 and 4.9). The id in the address is the secret, so
// this page tells a visitor only the store and role it names, and it works out what
// to offer from who is looking: signed out, sign in or create an account and come
// back here; the invited email, Accept; anyone else, one plain message.
// Never a list of invitations: only this one, by its id.

import type { Metadata } from "next";
import { headers } from "next/headers";

import { InviteView } from "@/components/invite/invite-view";
import { lookInvitation } from "@/lib/access/invitation-look";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The link is private: keep it out of search results and don't send it on as a referrer.
export const metadata: Metadata = { title: "Invitation", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const viewer = session ? { id: session.user.id, email: session.user.email } : null;
  const look = await lookInvitation(id, viewer);
  return <InviteView id={id} look={look} signedInAs={viewer?.email ?? null} />;
}
