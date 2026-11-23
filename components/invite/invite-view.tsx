// The invitation page's body (spec 0.7, 4.8): one card for whichever state the
// invitation is in for this visitor. The page works out the state on the server
// (lib/access/invitation-look.ts); this only words it. A server component: only
// the Accept button runs in the browser.

import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { InvitationState } from "@/lib/access/invitation-look";
import { authHref } from "@/lib/return-path";

import { AcceptButton } from "./accept-button";
import { unusableText } from "./invite-text";
import { PageShell } from "./page-shell";

type InviteViewProps = {
  id: string;
  look: InvitationState;
  /** Shown to someone signed in, so they can see which account would join. */
  signedInAs: string | null;
};

export function InviteView({ id, look, signedInAs }: InviteViewProps) {
  const here = `/invite/${id}`;
  if (look.state === "missing" || look.state === "used" || look.state === "cancelled") {
    return (
      <PageShell>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Invitation</h1>
        <p role="status" className="text-ink">
          {unusableText(look.state)}
        </p>
      </PageShell>
    );
  }

  const { storeName, roleName } = look;
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Join {storeName}</h1>
      <p className="text-ink-muted">
        You&apos;re invited to join <span className="font-medium text-ink">{storeName}</span> as <span className="font-medium text-ink">{roleName}</span>.
      </p>
      {look.state === "signed-out" ? (
        <>
          <p className="text-sm text-ink-muted">Sign in, or create an account, with the email address this invitation was sent to.</p>
          <Button asChild>
            <Link href={authHref("/sign-in", here)}>Sign in</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={authHref("/sign-up", here)}>Create an account</Link>
          </Button>
        </>
      ) : null}
      {look.state === "ready" ? (
        <>
          {look.paused ? (
            <p role="status" className="text-sm text-ink">
              {storeName} is paused right now. You can accept, but you won&apos;t see it until Liminal Bloom restores it.
            </p>
          ) : null}
          {signedInAs ? <p className="text-sm text-ink-muted">You&apos;re signed in as {signedInAs}.</p> : null}
          <AcceptButton invitationId={id} storeName={storeName} />
        </>
      ) : null}
      {look.state === "expired" || look.state === "lapsed" || look.state === "already-member" || look.state === "full" || look.state === "wrong-email" ? (
        <p role="status" className="text-ink">
          {unusableText(look.state, storeName)}
        </p>
      ) : null}
      {look.state === "wrong-email" ? (
        <Button asChild variant="secondary">
          <Link href={authHref("/sign-in", here)}>Sign in with another account</Link>
        </Button>
      ) : null}
      {look.state === "already-member" ? (
        <Button asChild variant="secondary">
          <Link href="/home">Go to Home</Link>
        </Button>
      ) : null}
    </PageShell>
  );
}
