// "Two-step sign-in" on Account (spec 0.7.1 8.3, A3b): off, with Turn on (the setup steps open in place);
// on, with the backup codes left, New backup codes and Turn off. A Liminal Bloom admin has no Turn off. The
// server actions are props (they carry the Account guard); `status` is read on the server, and only the
// count of backup codes comes through, never the codes.

"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";
import type { CodesActionReply, ConfirmActionReply, DisableActionReply, StartActionReply } from "@/lib/two-factor/replies";
import type { TwoFactorStatus } from "@/lib/two-factor/status";

import { NewBackupCodes } from "./new-codes";
import { TwoFactorSetup } from "./setup";
import { TurnOffForm } from "./turn-off-form";

type Props = {
  status: TwoFactorStatus;
  start: (password: string) => Promise<StartActionReply>;
  confirm: (code: string) => Promise<ConfirmActionReply>;
  makeCodes: (password: string) => Promise<CodesActionReply>;
  disable: (password: string, code: string) => Promise<DisableActionReply>;
};

export function TwoFactorCard({ status, start, confirm, makeCodes, disable }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "setup" | "off">("idle");
  const left = `${status.codesLeft} backup ${status.codesLeft === 1 ? "code" : "codes"} left.`;

  return (
    <Card id="two-factor" className="flex scroll-mt-20 flex-col gap-3">
      {!status.on && mode === "setup" ? (
        <TwoFactorSetup level={2} intro="After your password, sign-in asks for a code from an authenticator app." start={start} confirm={confirm} doneHref="/account" />
      ) : (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
            Two-step sign-in
            <InfoPopover term="twoStep" />
          </h2>
          {status.on ? (
            <>
              <p className="text-sm text-ink">On. Signing in asks for a code from your authenticator app. {left}</p>
              <NewBackupCodes make={makeCodes} level={3} />
              {status.isAdmin ? (
                <p className="text-sm text-ink-muted">Liminal Bloom admins need two-step sign-in, so it stays on.</p>
              ) : mode === "off" ? (
                <TurnOffForm
                  disable={disable}
                  onCancel={() => setMode("idle")}
                  onOff={() => {
                    setMode("idle");
                    router.refresh();
                  }}
                />
              ) : (
                <Button variant="secondary" className="self-start" onClick={() => setMode("off")}>
                  Turn off
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">Off. Signing in asks for your password only. Turn it on to add a code from your phone.</p>
              <Button variant="secondary" className="self-start" onClick={() => setMode("setup")}>
                Turn on
              </Button>
            </>
          )}
        </>
      )}
    </Card>
  );
}
