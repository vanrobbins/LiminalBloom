// One account as an admin sees it (spec 0.7.1 7.3): the account's own facts, the stores it belongs to and the
// invitations sent to its address, and the help actions on them (person-actions.tsx). No store data, and no
// secrets: lib/admin/reads-people.ts selects none.

import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CancelInvitation, PersonActions } from "@/components/admin/person-actions";
import { PausedBadge } from "@/components/admin/paused-badge";
import { LocalTime } from "@/components/time/local-time";
import type { PersonLookup } from "@/lib/admin/reads-people";

const LINK = "text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="wrap-break-word text-ink">{children}</dd>
    </div>
  );
}

function twoStep(p: PersonLookup) {
  const parts = [p.twoFactorEnabled ? "Authenticator app" : null, p.passkeys > 0 ? `${p.passkeys} ${p.passkeys === 1 ? "passkey" : "passkeys"}` : null].filter(Boolean);
  return parts.length > 0 ? `On: ${parts.join(", ")}` : "Off";
}

export function PersonCard({ person }: { person: PersonLookup }) {
  return (
    <section aria-labelledby="person-name" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="person-name" className="text-xl font-semibold tracking-tight text-ink wrap-break-word">
          {person.name}
        </h2>
        {person.isAdmin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-line-subtle px-2.5 py-0.5 text-sm font-medium text-ink">
            <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Liminal Bloom admin
          </span>
        ) : null}
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label="Email">{person.email}</Fact>
        <Fact label="Created">
          <LocalTime at={person.createdAt} />
        </Fact>
        <Fact label="Two-step sign-in">{twoStep(person)}</Fact>
        <Fact label="Signed in on">{person.sessions === 1 ? "1 device" : `${person.sessions} devices`}</Fact>
      </dl>
      <PersonActions userId={person.userId} name={person.name} sessions={person.sessions} canReset={!person.isAdmin && (person.twoFactorEnabled || person.passkeys > 0)} />

      <section aria-labelledby="person-stores" className="flex flex-col gap-2">
        <h3 id="person-stores" className="font-semibold text-ink">Stores</h3>
        {person.stores.length === 0 ? (
          <p className="text-ink-muted">Not in any store.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-subtle">
            {person.stores.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <Link href={`/admin/stores/${s.id}`} className={`inline-flex min-h-11 items-center wrap-break-word ${LINK}`}>
                  {s.name}
                </Link>
                <span className="text-sm text-ink-muted">{s.roleName ?? "No role"}</span>
                {s.paused ? <PausedBadge /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="person-invitations" className="flex flex-col gap-2">
        <h3 id="person-invitations" className="font-semibold text-ink">Invitations waiting</h3>
        {person.invitations.length === 0 ? (
          <p className="text-ink-muted">None.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-subtle">
            {person.invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
                <div className="flex flex-col gap-0.5">
                  <p className="wrap-break-word text-ink">
                    {i.storeName} <span className="text-ink-muted">as {i.roleName ?? "no role"}</span>
                  </p>
                  <p className="text-sm text-ink-muted">
                    {i.expired ? "Expired " : "Expires "}
                    <LocalTime at={i.expiresAt} />
                  </p>
                </div>
                <CancelInvitation invitationId={i.id} email={person.email} storeName={i.storeName} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
