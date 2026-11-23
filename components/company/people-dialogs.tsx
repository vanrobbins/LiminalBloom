// Change a regional manager's region, remove a company role, and cancel a waiting invitation (spec 0.7.1 6.5). Each
// confirms; the server decides, re-checks the rank rule and answers in words inside the dialog. Both writes carry the
// assignment's version the page showed, so a change made elsewhere meanwhile is refused as out of date.

"use client";

import { useState } from "react";

import { cancelCompanyInvitationAction, changeRegionAction, removeCompanyPersonAction } from "@/app/(app)/company/people-actions";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import type { CompanyInvitationRow, PersonRow } from "@/lib/companies/people-read";

import { ActionDialog } from "./action-dialog";
import type { RegionChoice } from "./invite-company-dialog";

type Shared = { opener: HTMLElement | null; onClose: () => void };

const problem = (reply: { status: string; message: string }) => (reply.status === "saved" ? null : reply.message);

export function ChangeRegionDialog({ person, regions, ...shared }: Shared & { person: PersonRow; regions: RegionChoice[] }) {
  const [region, setRegion] = useState(person.regionId ?? "");
  return (
    <ActionDialog
      {...shared}
      title={`Change ${person.name}'s region`}
      confirm="Change region"
      loadingText="Changing…"
      ready={region !== "" && region !== person.regionId}
      run={async () => problem(await changeRegionAction(person.userId, region, person.version))}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="change-region" className="text-sm text-ink">
          Region
        </label>
        <select id="change-region" value={region} onChange={(event) => setRegion(event.target.value)} className={FIELD_CLASSES}>
          {regions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-ink-muted">They reach the stores of the new region from their next page.</p>
      </div>
    </ActionDialog>
  );
}

export function RemovePersonDialog({ person, ...shared }: Shared & { person: PersonRow }) {
  return (
    <ActionDialog
      {...shared}
      title={`Remove ${person.name}?`}
      description={`${person.name} stops being ${person.roleName} and loses the company's stores. Any store they belong to as staff stays.`}
      confirm="Remove"
      loadingText="Removing…"
      danger
      run={async () => problem(await removeCompanyPersonAction(person.userId, person.version))}
    />
  );
}

export function CancelInvitationDialog({ invitation, ...shared }: Shared & { invitation: CompanyInvitationRow & { id: string } }) {
  return (
    <ActionDialog
      {...shared}
      title="Cancel this invitation?"
      description={`The link sent to ${invitation.email} stops working.`}
      confirm="Cancel invitation"
      loadingText="Cancelling…"
      danger
      run={async () => problem(await cancelCompanyInvitationAction(invitation.id))}
    />
  );
}
