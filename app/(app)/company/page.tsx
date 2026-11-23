// /company (spec 0.7.1 6.1, 6.2): the company's details, regions, stores and recent changes. The guard is
// requireCompanyPerson: a person with a company role, in a store or (company-only) with none yet; everyone else
// is sent where they belong. Each section gets only what its company switch lets the viewer do, and the reads
// scope a regional manager to their own region; every action checks its switch again. People and invitations
// need company.people; Ownership is the owner's alone (a fact on the company, not a switch).

import { CompanyFrame } from "@/components/company/company-frame";
import { OwnershipSection } from "@/components/company/ownership-section";
import { PeopleSection } from "@/components/company/people-section";
import { DetailsSection } from "@/components/company/details-section";
import { RecentSection } from "@/components/company/recent-section";
import { RegionsSection } from "@/components/company/regions-section";
import { StoresSection } from "@/components/company/stores-section";
import { companyRole } from "@/lib/access/company-roles";
import { requireCompanyPerson } from "@/lib/companies/guard";
import { assignableRoles, companyPeople } from "@/lib/companies/people-read";
import { companyView } from "@/lib/companies/queries";
import { recentChanges } from "@/lib/companies/recent";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const person = await requireCompanyPerson();
  const { company } = person;
  const can = (wanted: (typeof company.switches)[number]) => company.switches.includes(wanted);
  const [view, recent, people] = await Promise.all([companyView(company), can("company.people") ? recentChanges(company) : null, can("company.people") ? companyPeople(company, person.user.id) : null]);
  const roles = assignableRoles(company.role);
  const regions = view.regions.map(({ id, name }) => ({ id, name }));

  return (
    <CompanyFrame kind={person.kind} title={view.name}>
      <DetailsSection name={view.name} ownerName={view.ownerName} roleName={companyRole(company.role).name} regionName={company.regionName} canRename={can("company.settings")} />
      <RegionsSection regions={view.regions} canEdit={can("company.structure")} />
      <StoresSection stores={view.stores} regions={view.regions} canEdit={can("company.structure")} activeStoreId={person.activeStoreId} />
      {people ? <PeopleSection people={people.people} invitations={people.invitations} roles={roles} regions={regions} /> : null}
      {people && company.role === "owner" ? (
        <OwnershipSection companyName={view.name} admins={people.people.filter((p) => p.role === "corporate_admin").map((p) => ({ userId: p.userId, name: p.name }))} version={people.version} roles={roles} regions={regions} />
      ) : null}
      {recent ? <RecentSection changes={recent} /> : null}
    </CompanyFrame>
  );
}
