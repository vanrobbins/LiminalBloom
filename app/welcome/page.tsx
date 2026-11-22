// Where a signed-in person with no store lands (spec 0.7, 4.8): accept an invitation
// that is waiting for their email (by name: the invite link is the secret, so they
// paste it to accept), or create a store. It replaces the redirect to
// /create-store, which stays the form. Someone who has a store has no business here,
// and someone signed out has nothing to show.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/invite/page-shell";
import { PasteLinkForm } from "@/components/invite/paste-link-form";
import { WaitingList } from "@/components/invite/waiting-list";
import { Button } from "@/components/ui/button";
import { pendingInvitationsFor } from "@/lib/access/invitation-look";
import { auth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/current-member";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const current = await getCurrentMember();
  if (current.kind === "signed-out") redirect("/sign-in");
  if (current.kind === "member") redirect("/home");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const waiting = await pendingInvitationsFor({ id: session.user.id, email: session.user.email });

  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Welcome</h1>
      <p className="text-ink-muted">You&apos;re not in a store yet.</p>
      {waiting.length > 0 ? (
        <WaitingList invitations={waiting} />
      ) : (
        <p className="text-sm text-ink-muted">No invitations are waiting for {session.user.email}. If someone invited you, paste the link they sent below.</p>
      )}
      <PasteLinkForm />
      <Button asChild variant="secondary">
        <Link href="/create-store">Create a store</Link>
      </Button>
    </PageShell>
  );
}
