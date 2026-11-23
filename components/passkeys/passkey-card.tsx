// "Passkeys" on Account (spec 0.7.1 8.4, A3c): the list with last used, rename, remove, and Add. A passkey
// signs in without a password and counts as the second step. The actions are props (they carry the Account
// guard); the page is read again after each change.

"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";

import { AddPasskey } from "./add-passkey";
import { PasskeyRow } from "./passkey-row";
import type { PasskeyActions, PasskeyItem } from "./types";

export function PasskeyCard({ passkeys, allow, rename, remove }: { passkeys: PasskeyItem[] } & PasskeyActions) {
  const router = useRouter();
  const changed = () => router.refresh();
  return (
    <Card id="passkeys" className="flex scroll-mt-20 flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <KeyRound aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
        Passkeys
        <InfoPopover term="passkey" />
      </h2>
      {passkeys.length === 0 ? (
        <p className="text-sm text-ink-muted">None yet. A passkey lets you sign in with your fingerprint, face or device PIN, and counts as your second step.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {passkeys.map((item) => (
            <li key={item.id}>
              <PasskeyRow item={item} rename={rename} remove={remove} onChanged={changed} />
            </li>
          ))}
        </ul>
      )}
      <AddPasskey allow={allow} rename={rename} onAdded={changed} first={passkeys.length === 0} />
    </Card>
  );
}
