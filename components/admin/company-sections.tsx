// The sections of /admin/companies/[id] (spec 0.7.1 7.3): the corporate admins, with the hand-off beside each; the
// regions and stores; and the invitations waiting. Names, emails, roles, counts and dates only.

import Link from "next/link";

import { CancelCompanyInvitation, HandOffTo } from "@/components/admin/company-actions";
import { PausedBadge } from "@/components/admin/paused-badge";
import { LocalTime } from "@/components/time/local-time";
import { companyRole, type CompanyRoleKey } from "@/lib/access/company-roles";
import type { CompanyDetail } from "@/lib/admin/reads-companies";

const LINK = "text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const roleName = (role: string) => companyRole(role as CompanyRoleKey).name;

export function CorporateAdmins({ company }: { company: CompanyDetail }) {
  return (
    <section aria-labelledby="admins" className="flex flex-col gap-2">
      <h2 id="admins" className="text-lg font-semibold text-ink">Corporate admins</h2>
      {company.corporateAdmins.length === 0 ? (
        <p className="text-ink-muted">No corporate admin yet, so there is nobody to hand ownership to.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-subtle">
          {company.corporateAdmins.map((a) => (
            <li key={a.userId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
              <div className="flex flex-col gap-0.5">
                <p className="wrap-break-word text-ink">{a.name}</p>
                <Link href={`/admin/people?email=${encodeURIComponent(a.email)}`} className={`inline-flex min-h-11 items-center self-start text-sm break-all text-ink-muted ${LINK}`}>
                  {a.email}
                </Link>
              </div>
              <HandOffTo companyId={company.id} companyName={company.name} userId={a.userId} name={a.name} version={company.version} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PlacesSection({ company }: { company: CompanyDetail }) {
  return (
    <section aria-labelledby="places" className="flex flex-col gap-4">
      <h2 id="places" className="text-lg font-semibold text-ink">Regions and stores</h2>
      {company.regions.length === 0 ? <p className="text-ink-muted">No regions.</p> : null}
      {company.regions.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line-subtle">
          {company.regions.map((r) => (
            <li key={r.id} className="py-2 text-ink">
              {r.name} <span className="text-ink-muted">{r.stores} {r.stores === 1 ? "store" : "stores"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {company.stores.length === 0 ? (
        <p className="text-ink-muted">No stores yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-subtle">
          {company.stores.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
              <div className="flex flex-col gap-0.5">
                <Link href={`/admin/stores/${s.id}`} className={`inline-flex min-h-11 items-center self-start ${LINK}`}>
                  {s.name}
                </Link>
                <p className="text-sm text-ink-muted">{s.region ?? "No region"}</p>
              </div>
              {s.paused ? <PausedBadge /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InvitationsSection({ company }: { company: CompanyDetail }) {
  return (
    <section aria-labelledby="invitations" className="flex flex-col gap-2">
      <h2 id="invitations" className="text-lg font-semibold text-ink">Invitations waiting</h2>
      {company.invitations.length === 0 ? (
        <p className="text-ink-muted">None.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-subtle">
          {company.invitations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
              <div className="flex flex-col gap-0.5">
                <p className="break-all text-ink">
                  {i.email} <span className="text-ink-muted">as {roleName(i.role)}{i.region ? `, ${i.region}` : ""}</span>
                </p>
                <p className="text-sm text-ink-muted">
                  {i.expired ? "Expired " : "Expires "}
                  <LocalTime at={i.expiresAt} />
                </p>
              </div>
              <CancelCompanyInvitation invitationId={i.id} email={i.email} companyName={company.name} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
