// /admin/companies (spec 0.7.1 7.3): every company, with its owner, corporate admins, counts and whether it is paused.
// The list stops at 500 and says so.

import { CompanyList } from "@/components/admin/company-list";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { listCompanies, MAX_COMPANIES } from "@/lib/admin/reads-companies";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  await requirePlatformAdmin();
  const { companies, truncated } = await listCompanies();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Companies</h1>
      {truncated ? <p className="text-ink-muted">{`Showing the first ${MAX_COMPANIES} companies.`}</p> : null}
      <CompanyList companies={companies} />
    </>
  );
}
