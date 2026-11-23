// /company (spec 0.7.1 6.1, 6.2): the company's details, regions, stores and recent changes. The guard is
// requireCompanyPerson: a person with a company role, in a store or (company-only) with none yet; everyone else
// is sent where they belong. Each section gets only what its company switch lets the viewer do, and the reads
// scope a regional manager to their own region; every action checks its switch again. Company people and
// invitations (company.people) are B7's sections.

import { CompanyFrame } from "@/components/company/company-frame";
import { DetailsSection } from "@/components/company/details-section";
import { RecentSection } from "@/components/company/recent-section";
import { RegionsSection } from "@/components/company/regions-section";
import { StoresSection } from "@/components/company/stores-section";
import { companyRole } from "@/lib/access/company-roles";
import { requireCompanyPerson } from "@/lib/companies/guard";
import { companyView } from "@/lib/companies/queries";
import { recentChanges } from "@/lib/companies/recent";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const person = await requireCompanyPerson();
  const { company } = person;
  const can = (wanted: (typeof company.switches)[number]) => company.switches.includes(wanted);
  const [view, recent] = await Promise.all([companyView(company), can("company.people") ? recentChanges(company) : null]);

  return (
    <CompanyFrame kind={person.kind} title={view.name}>
      <DetailsSection name={view.name} ownerName={view.ownerName} roleName={companyRole(company.role).name} regionName={company.regionName} canRename={can("company.settings")} />
      <RegionsSection regions={view.regions} canEdit={can("company.structure")} />
      <StoresSection stores={view.stores} regions={view.regions} canEdit={can("company.structure")} activeStoreId={person.activeStoreId} />
      {recent ? <RecentSection changes={recent} /> : null}
    </CompanyFrame>
  );
}
