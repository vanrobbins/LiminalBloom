// /company's Details (spec 0.7.1 6.2): the company's name, who owns it, and what the viewer is. With
// `company.settings` the name saves as it changes; everyone else reads it, with one line saying why not.

import { Card } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";

import { CompanyNameForm } from "./company-name-form";

type DetailsProps = { name: string; ownerName: string; roleName: string; regionName: string | null; canRename: boolean };

export function DetailsSection({ name, ownerName, roleName, regionName, canRename }: DetailsProps) {
  return (
    <Card compact role="region" aria-labelledby="company-details-heading">
      <h2 id="company-details-heading" className="mb-3 inline-flex items-center gap-1 text-lg font-semibold text-ink">
        Details
        <InfoPopover term="company" />
      </h2>
      <div className="flex flex-col gap-4">
        {canRename ? (
          <CompanyNameForm name={name} />
        ) : (
          <dl>
            <dt className="text-sm text-ink-muted">Name</dt>
            <dd className="text-ink wrap-break-word">{name}</dd>
          </dl>
        )}
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="text-sm text-ink-muted">Owner</dt>
            <dd className="text-ink wrap-break-word">{ownerName}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Your role</dt>
            <dd className="text-ink">{regionName ? `${roleName} · ${regionName}` : roleName}</dd>
          </div>
        </dl>
        {canRename ? null : <p className="text-sm text-ink-muted">Your role can&apos;t change the company&apos;s name.</p>}
      </div>
    </Card>
  );
}
