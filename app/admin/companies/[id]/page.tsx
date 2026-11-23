// /admin/companies/[id] (spec 0.7.1 7.3): one company's owner, corporate admins, regions, stores and waiting invitations,
// and its help actions: Pause or Restore, Hand ownership to a corporate admin, Cancel invitation.

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PauseRestoreCompany } from "@/components/admin/company-actions";
import { CorporateAdmins, InvitationsSection, PlacesSection } from "@/components/admin/company-sections";
import { PausedBadge } from "@/components/admin/paused-badge";
import { LocalTime } from "@/components/time/local-time";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { companyDetail } from "@/lib/admin/reads-companies";

export const dynamic = "force-dynamic";

export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const company = await companyDetail((await params).id);
  if (!company) notFound();
  return (
    <>
      <Link href="/admin/companies" className="inline-flex min-h-11 items-center gap-2 self-start text-ink-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Companies
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink wrap-break-word md:text-3xl">{company.name}</h1>
        {company.pause ? <PausedBadge /> : null}
      </div>
      <PauseRestoreCompany companyId={company.id} companyName={company.name} paused={company.pause !== null} />
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="facts" className="flex flex-col gap-4">
          <h2 id="facts" className="text-lg font-semibold text-ink">Details</h2>
          <dl className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-ink-muted">Owner</dt>
              <dd className="wrap-break-word text-ink">
                {company.owner.name} <span className="text-ink-muted break-all">{company.owner.email}</span>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-ink-muted">Counts</dt>
              <dd className="text-ink">
                {company.regions.length} {company.regions.length === 1 ? "region" : "regions"} · {company.stores.length} {company.stores.length === 1 ? "store" : "stores"} · {company.people}{" "}
                {company.people === 1 ? "person" : "people"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-ink-muted">Created</dt>
              <dd className="text-ink">
                <LocalTime at={company.createdAt} />
              </dd>
            </div>
            {company.pause ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-ink-muted">Paused</dt>
                <dd className="wrap-break-word text-ink">
                  <LocalTime at={company.pause.since} /> by {company.pause.byName}
                  {company.pause.reason ? `: ${company.pause.reason}` : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
        <div className="flex flex-col gap-8">
          <CorporateAdmins company={company} />
          <InvitationsSection company={company} />
        </div>
      </div>
      <PlacesSection company={company} />
    </>
  );
}
