// Where a signed-in person with no store lands (spec 0.7, 4.8): accept an invitation
// that is waiting for their email (by name: the invite link is the secret, so they
// paste it to accept), or create a store. It replaces the redirect to
// /create-store, which stays the form. Someone who has a store has no business here,
// and someone signed out has nothing to show.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/invite/page-shell";
import { AskButton } from "@/components/help/ask-button";
import { ReplyBanner } from "@/components/help/reply-banner";
import { PasteLinkForm } from "@/components/invite/paste-link-form";
import { WaitingList } from "@/components/invite/waiting-list";
import { Button } from "@/components/ui/button";
import { pendingInvitationsFor } from "@/lib/access/invitation-look";
import { auth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/current-member";
import { helpRepliesFor } from "@/lib/help/badge";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const current = await getCurrentMember();
  if (current.kind === "signed-out") redirect("/sign-in");
  if (current.kind === "member") redirect("/home");
  // A role in the store they belong to asks for two-step sign-in first; Account is where it is set up.
  if (current.kind === "needs-two-factor") redirect("/account");
  // Every store they belong to is paused: they are not "without a store", so say what happened.
  if (current.kind === "paused") redirect("/paused");
  // A company role and no store yet: the company page is their home.
  if (current.kind === "company-only") redirect("/company");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const [waiting, helpReplies] = await Promise.all([pendingInvitationsFor({ id: session.user.id, email: session.user.email }), helpRepliesFor(session.user.id)]);

  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Welcome</h1>
      <ReplyBanner replies={helpReplies} />
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
      <AskButton kind="account" from="/welcome" />
    </PageShell>
  );
}
