// The invitations waiting for a signed-in person's email, on /welcome (spec 0.7,
// 4.8). Names the store and role only: accepting takes the invite link they were
// sent, which is the secret (4.9), so there is no link or Accept here; the paste
// form beside it (paste-link-form.tsx) is the way in.

import { LocalTime } from "@/components/time/local-time";
import type { WaitingInvitation } from "@/lib/access/invitation-look";

export function WaitingList({ invitations }: { invitations: WaitingInvitation[] }) {
  return (
    <section aria-labelledby="waiting-heading" className="flex flex-col gap-2">
      <h2 id="waiting-heading" className="text-lg font-semibold text-ink">
        Invitations for you
      </h2>
      <ul className="flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
        {invitations.map((i, n) => (
          <li key={n} className="flex flex-col gap-2 bg-raised px-4 py-3">
            <span className="flex flex-col">
              <span className="font-medium text-ink wrap-break-word">{i.storeName}</span>
              <span className="text-sm text-ink-muted">
                {i.roleName} role · Expires <LocalTime at={i.expiresAt} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">Paste the invite link you were sent below to join.</p>
    </section>
  );
}
