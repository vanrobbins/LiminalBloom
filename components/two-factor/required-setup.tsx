// What a person sees when their role asks for two-step sign-in and they have none (spec 0.7.1, A3b):
// Account, with only the setup and a way out. Everything else redirects here (lib/current-member.ts), so
// the way out has to work from this page: Sign out is here, outside the app shell this person is kept from.

"use client";

import { PageShell } from "@/components/invite/page-shell";
import { useSignOut } from "@/components/shell/use-sign-out";
import { Button } from "@/components/ui/button";
import type { ConfirmActionReply, StartActionReply } from "@/lib/two-factor/replies";

import { TwoFactorSetup } from "./setup";

type Props = {
  roleName: string;
  start: (password: string) => Promise<StartActionReply>;
  confirm: (code: string) => Promise<ConfirmActionReply>;
};

export function RequiredTwoFactor({ roleName, start, confirm }: Props) {
  const { signOut, isSigningOut } = useSignOut();
  return (
    <PageShell>
      <TwoFactorSetup intro={`Your role, ${roleName}, needs two-step sign-in. Turn it on to carry on.`} start={start} confirm={confirm} doneHref="/home" />
      <Button type="button" variant="ghost" loading={isSigningOut} loadingText="Signing out…" onClick={() => void signOut()}>
        Sign out
      </Button>
    </PageShell>
  );
}
