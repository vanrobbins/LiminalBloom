// The help actions on one company (spec 0.7.1 7.4), on /admin/companies/[id]: Pause or Restore in its header,
// Hand ownership to beside each corporate admin, and Cancel invitation beside each waiting invitation. Each opens the
// shared reason dialog; the page refreshes once it is done.

"use client";

import { CirclePause, CirclePlay, Crown, MailX } from "lucide-react";

import { cancelCompanyInvitationAction, handOffCompanyAction, pauseCompanyAction, restoreCompanyAction } from "@/app/admin/companies/actions";

import { AdminAction } from "./admin-action";

export function PauseRestoreCompany({ companyId, companyName, paused }: { companyId: string; companyName: string; paused: boolean }) {
  return paused ? (
    <AdminAction
      label="Restore"
      icon={CirclePlay}
      title={`Restore ${companyName}?`}
      description="The company and its stores open again for everyone in them, as they were. Nothing was deleted while it was paused."
      confirm="Restore company"
      loadingText="Restoring…"
      doneToast="Company restored."
      messages={{ already: "That company isn't paused. Close and look again." }}
      run={(reason) => restoreCompanyAction(companyId, reason)}
    />
  ) : (
    <AdminAction
      label="Pause"
      icon={CirclePause}
      buttonVariant="quiet-danger"
      title={`Pause ${companyName}?`}
      description="Every store of the company drops out of everyone's list and nobody can open them until it is restored. The owner and the company's people see a page saying so. Nothing is deleted."
      confirm="Pause company"
      loadingText="Pausing…"
      variant="danger"
      doneToast="Company paused."
      messages={{ already: "That company is already paused. Close and look again." }}
      run={(reason) => pauseCompanyAction(companyId, reason)}
    />
  );
}

export function HandOffTo({ companyId, companyName, userId, name, version }: { companyId: string; companyName: string; userId: string; name: string; version: number }) {
  return (
    <AdminAction
      label={`Hand ownership to ${name}`}
      icon={Crown}
      title={`Hand ${companyName} to ${name}?`}
      description={`${name} becomes the owner. The current owner stays as a corporate admin, and ${name} can change that.`}
      confirm="Hand off"
      loadingText="Handing off…"
      variant="danger"
      doneToast="Ownership handed off."
      messages={{ already: "The company has changed since you looked. Close and look again.", gone: `${name} is no longer a corporate admin of ${companyName}. Close and look again.` }}
      run={(reason) => handOffCompanyAction(companyId, userId, version, reason)}
    />
  );
}

export function CancelCompanyInvitation({ invitationId, email, companyName }: { invitationId: string; email: string; companyName: string }) {
  return (
    <AdminAction
      label="Cancel invitation"
      icon={MailX}
      buttonVariant="quiet-danger"
      title="Cancel this invitation?"
      description={`The invitation for ${email} to ${companyName} stops working. Send a new one to bring them back.`}
      confirm="Cancel invitation"
      loadingText="Canceling…"
      variant="danger"
      rowGoes
      run={(reason) => cancelCompanyInvitationAction(invitationId, reason)}
    />
  );
}
