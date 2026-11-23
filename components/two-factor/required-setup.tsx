// What a person sees when their role asks for two-step sign-in and they have none (spec 0.7.1, A3b):
// Account, with only the setup and a way out. Everything else redirects here (lib/current-member.ts), so
// the way out has to work from this page: Sign out is here, outside the app shell this person is kept from.
// A passkey meets the requirement as well as an authenticator app (A3c), so Add a passkey is offered under the setup.

"use client";

import { PageShell } from "@/components/invite/page-shell";
import { useSignOut } from "@/components/shell/use-sign-out";
import { AddPasskey } from "@/components/passkeys/add-passkey";
import type { PasskeyActions } from "@/components/passkeys/types";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ConfirmActionReply, StartActionReply } from "@/lib/two-factor/replies";

import { TwoFactorSetup } from "./setup";

type Props = {
  roleName: string;
  start: (password: string) => Promise<StartActionReply>;
  confirm: (code: string) => Promise<ConfirmActionReply>;
} & Pick<PasskeyActions, "allow" | "rename">;

export function RequiredTwoFactor({ roleName, start, confirm, allow, rename }: Props) {
  const { signOut, isSigningOut } = useSignOut();
  const router = useRouter();
  return (
    <PageShell>
      <TwoFactorSetup intro={`Your role, ${roleName}, needs two-step sign-in. Turn it on to carry on.`} start={start} confirm={confirm} doneHref="/home" />
      <p className="text-sm text-ink-muted">Or use a passkey on this device instead of an authenticator app.</p>
      {/* With a passkey the account has a second factor: Account then opens in full. */}
      <AddPasskey allow={allow} rename={rename} onAdded={() => router.refresh()} first />
      <Button type="button" variant="ghost" loading={isSigningOut} loadingText="Signing out…" onClick={() => void signOut()}>
        Sign out
      </Button>
    </PageShell>
  );
}
