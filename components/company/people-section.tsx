// /company's People (spec 0.7.1 6.2, 6.5), for a holder of company.people: the owner, the corporate admins and the
// regional managers with their regions, and the invitations waiting. Invite is offered while there is a role below
// the viewer's own; a person's ⋯ menu offers only what the viewer may do by rank (`canAct`, decided on the server by
// the same rule the write checks again): Change region for a regional manager, Remove for any role below. A row the
// viewer outranks nothing on is read-only. The invitation's link is sent only for rows the viewer may act on.

"use client";

import { MapPin, Plus, UserMinus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CompanyInvitationRow, PersonRow } from "@/lib/companies/people-read";

import { InvitationsList } from "./invitations-list";
import { InviteCompanyDialog, type RegionChoice, type RoleChoice } from "./invite-company-dialog";
import { ChangeRegionDialog, RemovePersonDialog } from "./people-dialogs";
import { RowMenu } from "./row-menu";

type Open = { kind: "invite"; opener: HTMLElement | null } | { kind: "region" | "remove"; person: PersonRow; opener: HTMLElement | null };

const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-4 shrink-0" } as const;

export function PeopleSection({ people, invitations, roles, regions }: { people: PersonRow[]; invitations: CompanyInvitationRow[]; roles: RoleChoice[]; regions: RegionChoice[] }) {
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => setOpen(null);
  const shared = { opener: open?.opener ?? null, onClose: close };
  return (
    <Card compact role="region" aria-labelledby="company-people-heading">
      <div className="mb-3 flex items-center gap-3">
        <h2 id="company-people-heading" className="flex-1 text-lg font-semibold text-ink">
          People
        </h2>
        {roles.length > 0 ? (
          <Button variant="secondary" onClick={(event) => setOpen({ kind: "invite", opener: event.currentTarget })}>
            <Plus {...ICON} />
            Invite
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y divide-line-subtle">
        {people.map((p) => (
          <li key={p.userId} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 wrap-break-word text-ink">
              <span className="font-medium">{p.name}</span>
              <span className="text-ink-muted">
                {" · "}
                {p.roleName}
                {p.regionName ? ` · ${p.regionName}` : ""}
              </span>
              <span className="block text-sm text-ink-muted wrap-anywhere">{p.email}</span>
            </span>
            <RowMenu
              name={p.name}
              actions={
                p.canAct
                  ? [
                      ...(p.role === "regional_manager" ? [{ label: "Change region", icon: <MapPin {...ICON} />, run: (opener: HTMLElement | null) => setOpen({ kind: "region", person: p, opener }) }] : []),
                      { label: "Remove", icon: <UserMinus {...ICON} />, danger: true, run: (opener: HTMLElement | null) => setOpen({ kind: "remove", person: p, opener }) },
                    ]
                  : []
              }
            />
          </li>
        ))}
      </ul>
      <InvitationsList invitations={invitations} />
      {open?.kind === "invite" ? <InviteCompanyDialog {...shared} roles={roles} regions={regions} /> : null}
      {open?.kind === "region" ? <ChangeRegionDialog {...shared} person={open.person} regions={regions} /> : null}
      {open?.kind === "remove" ? <RemovePersonDialog {...shared} person={open.person} /> : null}
    </Card>
  );
}
