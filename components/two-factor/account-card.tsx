// "Two-step sign-in" on Account (spec 0.7.1 8.3, A3b): off, with Turn on (the setup steps open in place);
// on, with the backup codes left, New backup codes and Turn off. A Liminal Bloom admin, or anyone whose role requires it, has no Turn off unless they have a passkey (A3c). The
// server actions are props (they carry the Account guard); `status` is read on the server, and only the
// count of backup codes comes through, never the codes.

"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";
import type { CodesActionReply, ConfirmActionReply, DisableActionReply, StartActionReply } from "@/lib/two-factor/replies";
import type { TwoFactorStatus } from "@/lib/two-factor/status";

import { focusHeading } from "./focus-heading";
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
  // Turn on, Turn off and Cancel swap the control that had focus for another form (or back): focus goes to the
  // new step's heading, not to the page. Not on first render (that would take focus on page load).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else focusHeading(document.querySelector<HTMLElement>("#two-factor [data-focus-heading]"));
  }, [mode]);
  const left = `${status.codesLeft} backup ${status.codesLeft === 1 ? "code" : "codes"} left.`;
  // An admin, or a role that requires two-factor, keeps the app on unless a passkey is the second step left (A3c).
  const hasPasskey = status.passkeys.length > 0;

  return (
    <Card id="two-factor" className="flex scroll-mt-20 flex-col gap-3">
      {!status.on && mode === "setup" ? (
        <TwoFactorSetup level={2} intro="After your password, sign-in asks for a code from an authenticator app." start={start} confirm={confirm} doneHref="/account" />
      ) : (
        <>
          <h2 data-focus-heading={mode === "idle" ? "" : undefined} className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
            Two-step sign-in
            <InfoPopover term="twoStep" />
          </h2>
          {status.on ? (
            <>
              <p className="text-sm text-ink">On. Signing in asks for a code from your authenticator app. {left}</p>
              <NewBackupCodes make={makeCodes} level={3} />
              {status.isAdmin && !hasPasskey ? (
                <p className="text-sm text-ink-muted">Liminal Bloom admins need two-step sign-in, so it stays on.</p>
              ) : status.requiredBy && !hasPasskey ? (
                <p className="text-sm text-ink-muted">Your role in {status.requiredBy} requires two-factor sign-in.</p>
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
              <p className="text-sm text-ink-muted">
                {hasPasskey ? "Off. Your passkey counts as your second step. Turn this on to also use a code from your phone." : "Off. Signing in asks for your password only. Turn it on to add a code from your phone."}
              </p>
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
