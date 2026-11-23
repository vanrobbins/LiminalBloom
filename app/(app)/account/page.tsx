// Who is signed in, and the stores they belong to. Inside the app shell,
// which links here from its navigation and account menu.
//
// requireMember() reads the session on the SERVER, from the request's
// cookies, and redirects a signed-out visitor before any of this page is
// sent -- protected content never reaches a browser that should not have it
// (proposal section 8.3). This is the pattern every signed-in screen follows.

import Link from "next/link";
import { Plus, Store } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PasskeyCard } from "@/components/passkeys/passkey-card";
import { RequiredTwoFactor } from "@/components/two-factor/required-setup";
import { TwoFactorCard } from "@/components/two-factor/account-card";
import { requireAccountPerson } from "@/lib/current-member";
import { twoFactorStatus } from "@/lib/two-factor/status";

import { ChangePasswordForm } from "./change-password-form";
import { allowPasskeyAddAction, removePasskeyAction, renamePasskeyAction } from "./passkey-actions";
import { confirmTwoFactorAction, disableTwoFactorAction, newBackupCodesAction, startTwoFactorAction } from "./two-factor-actions";

export const dynamic = "force-dynamic";

const PASSKEY_ACTIONS = { allow: allowPasskeyAddAction, rename: renamePasskeyAction, remove: removePasskeyAction };

export default async function AccountPage() {
  // Membership-checked, so a store this person was removed from is never
  // shown as theirs. A person whose role asks for two-step sign-in and who has
  // none is not let into the app, so this page is where they set it up: it shows
  // only that (and Sign out), never a redirect back to itself.
  const person = await requireAccountPerson();
  if (person.kind === "needs-two-factor") {
    return <RequiredTwoFactor roleName={person.roleName} start={startTwoFactorAction} confirm={confirmTwoFactorAction} allow={allowPasskeyAddAction} rename={renamePasskeyAction} />;
  }
  const { user, stores, activeStoreId } = person;
  const two = await twoFactorStatus(user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title="Account" />

      <Card compact>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Name</dt>
            <dd className="text-ink">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Email</dt>
            <dd className="break-all text-ink">{user.email}</dd>
          </div>
        </dl>
      </Card>

      <ChangePasswordForm />

      <PasskeyCard passkeys={two.passkeys} needsCode={two.on} {...PASSKEY_ACTIONS} />

      <TwoFactorCard status={two} start={startTwoFactorAction} confirm={confirmTwoFactorAction} makeCodes={newBackupCodesAction} disable={disableTwoFactorAction} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink">
          {stores.length === 1 ? "Your store" : "Your stores"}
        </h2>
        <ul className="flex flex-col gap-2">
          {stores.map((store) => {
            const isActive = store.id === activeStoreId;

            return (
              <li key={store.id} aria-current={isActive ? "true" : undefined}>
                <Card compact className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-ink wrap-break-word">{store.name}</span>
                    {isActive ? <span className="text-ink-muted">Working in</span> : null}
                  </span>
                  {isActive ? (
                    <Button asChild icon variant="secondary">
                      <Link href="/store" aria-label="Open Store">
                        <Store aria-hidden="true" strokeWidth={1.75} className="size-5" />
                      </Link>
                    </Button>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
        <Button asChild variant="secondary" className="self-start">
          <Link href="/create-store">
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Create a store
          </Link>
        </Button>
      </section>
    </div>
  );
}
