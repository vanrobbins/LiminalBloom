// The help actions on one account (spec 0.7.1 7.4), under their name on /admin/people: Sign out everywhere and
// Reset two-factor, and Cancel invitation beside each waiting invitation. Each opens the shared reason dialog.

"use client";

import { LogOut, MailX, ShieldOff } from "lucide-react";

import { cancelInvitationAction, resetTwoFactorAction, signOutEverywhereAction } from "@/app/admin/people/actions";

import { AdminAction } from "./admin-action";

export function PersonActions({ userId, name, sessions, canReset }: { userId: string; name: string; sessions: number; canReset: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      {sessions > 0 ? (
        <AdminAction
          label="Sign out everywhere"
          icon={LogOut}
          title={`Sign ${name} out everywhere?`}
          description="Every device they are signed in on is signed out at once. They can sign in again with their password."
          confirm="Sign out everywhere"
          loadingText="Signing out…"
          variant="danger"
          doneToast="Signed out everywhere."
          run={(reason) => signOutEverywhereAction(userId, reason)}
        />
      ) : null}
      {canReset ? (
        <AdminAction
          label="Reset two-step sign-in"
          icon={ShieldOff}
          title={`Reset two-step sign-in for ${name}?`}
          description="Their authenticator app, backup codes, passkeys and trusted devices are removed and they are signed out everywhere. They sign in with their password and can set it up again."
          confirm="Reset two-step sign-in"
          loadingText="Resetting…"
          variant="danger"
          run={(reason) => resetTwoFactorAction(userId, reason)}
        />
      ) : null}
    </div>
  );
}

export function CancelInvitation({ invitationId, email, storeName }: { invitationId: string; email: string; storeName: string }) {
  return (
    <AdminAction
      label="Cancel invitation"
      icon={MailX}
      buttonVariant="quiet-danger"
      title="Cancel this invitation?"
      description={`The invitation for ${email} to ${storeName} stops working. Send a new one to bring them back.`}
      confirm="Cancel invitation"
      loadingText="Canceling…"
      variant="danger"
      rowGoes
      run={(reason) => cancelInvitationAction(invitationId, reason)}
    />
  );
}
