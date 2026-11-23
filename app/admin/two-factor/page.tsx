// /admin/two-factor (spec 0.7.1 8.3): setup for an admin without two-step sign-in, and for one who has it,
// "Two-step sign-in is on" with New backup codes. Setup needs only an admin account (that is its purpose);
// the "on" side needs a fresh factor like every other /admin page.

import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { PageShell } from "@/components/invite/page-shell";
import { NewBackupCodes } from "@/components/two-factor/new-codes";
import { TwoFactorSetup } from "@/components/two-factor/setup";
import { Button } from "@/components/ui/button";
import { requirePlatformAdmin, requirePlatformAdminAccount } from "@/lib/admin/guard";

import { newBackupCodesAction } from "./codes-actions";
import { confirmTwoFactorAction, startTwoFactorAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminTwoFactorPage() {
  const account = await requirePlatformAdminAccount();
  if (!account.twoFactorEnabled) {
    return (
      <PageShell>
        <TwoFactorSetup intro={account.passkey ? "You sign in with a passkey, which counts. This adds an authenticator app as well." : "Liminal Bloom admins need it."} start={startTwoFactorAction} confirm={confirmTwoFactorAction} doneHref="/admin" />
      </PageShell>
    );
  }
  await requirePlatformAdmin();
  return (
    <PageShell>
      <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-ink">
        <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-8 shrink-0" />
        Two-step sign-in is on
      </h1>
      <NewBackupCodes make={newBackupCodesAction} />
      <Button asChild variant="secondary">
        <Link href="/admin">Back to admin</Link>
      </Button>
    </PageShell>
  );
}
