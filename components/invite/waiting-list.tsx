// The invitations waiting for a signed-in person's email, on /welcome (spec 0.7,
// 4.8). Each has its own Accept; the link on the invitation page does the same.

import { LocalTime } from "@/components/time/local-time";
import type { WaitingInvitation } from "@/lib/access/invitation-look";

import { AcceptButton } from "./accept-button";

export function WaitingList({ invitations }: { invitations: WaitingInvitation[] }) {
  return (
    <section aria-labelledby="waiting-heading" className="flex flex-col gap-2">
      <h2 id="waiting-heading" className="text-lg font-semibold text-ink">
        Invitations for you
      </h2>
      <ul className="flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
        {invitations.map((i) => (
          <li key={i.id} className="flex flex-col gap-2 bg-raised px-4 py-3">
            <span className="flex flex-col">
              <span className="font-medium text-ink wrap-break-word">{i.storeName}</span>
              <span className="text-sm text-ink-muted">
                {i.roleName} role · Expires <LocalTime at={i.expiresAt} />
              </span>
            </span>
            <AcceptButton invitationId={i.id} storeName={i.storeName} ariaLabel={`Accept invitation to ${i.storeName}`} label="Accept" />
          </li>
        ))}
      </ul>
    </section>
  );
}
