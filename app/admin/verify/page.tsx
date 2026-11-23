// /admin/verify (spec 0.7.1 8.3): the step-up for an admin whose session has no code or an old one.
// Needs an admin account; one without two-step sign-in goes to set it up, and one already fresh goes on.

import { redirect } from "next/navigation";

import { PageShell } from "@/components/invite/page-shell";
import { VerifyForm } from "@/components/two-factor/verify-form";
import { requirePlatformAdminAccount } from "@/lib/admin/guard";
import { isFresh } from "@/lib/admin/freshness";

import { dropReplacedSessionAction, verifyAdminCodeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminVerifyPage() {
  const account = await requirePlatformAdminAccount();
  // An authenticator app or a passkey is a second factor (A3c); the form offers whichever the admin has.
  if (!account.twoFactorEnabled && !account.passkey) redirect("/admin/two-factor");
  if (isFresh(account.twoFactorAt)) redirect("/admin");
  return (
    <PageShell>
      <VerifyForm verify={verifyAdminCodeAction} dropOld={dropReplacedSessionAction} doneHref="/admin" totp={account.twoFactorEnabled} passkey={account.passkey} />
    </PageShell>
  );
}
